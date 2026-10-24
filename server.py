"""
Magic Writer Dashboard — FastAPI backend.

Читает общую PostgreSQL (та же, что у Skapi backend), отдаёт KPI, воронку,
графики членства и таблицу пользователей для дашборда Magic Writer.
Доступ: только Tailscale / localhost (IP-фильтр, как в dashboard-almanac).

Запуск:
    uvicorn server:app --host 0.0.0.0 --port 8000

Env:
    DATABASE_URL        — asyncpg URL общей БД (обязателен)
    PAID_COMMUNITY_SLUG — slug платного сообщества (для стадии 'subscribed')
    TRIAL_POSTS_LIMIT   — лимит постов триала (default 5)
    COMMUNITY_PRICE     — цена подписки/мес для оценки MRR (default 0)
    SKAPI_BASE_URL      — URL Skapi backend для триггера синхронизации
    SKAPI_ADMIN_SECRET  — RATE_LIMIT_ADMIN_SECRET Skapi backend
    DISPLAY_TIMEZONE    — default Europe/Vienna
"""
import ipaddress
import os
import zoneinfo
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Magic Writer Dashboard")

# ═══════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════

DISPLAY_TIMEZONE = os.getenv("DISPLAY_TIMEZONE", "Europe/Vienna")
PORT = int(os.getenv("PORT", "8000"))
DATABASE_URL = os.getenv("DATABASE_URL", "")
TRIAL_POSTS_LIMIT = int(os.getenv("TRIAL_POSTS_LIMIT", "5"))
COMMUNITY_PRICE = float(os.getenv("COMMUNITY_PRICE", "0"))
PAID_COMMUNITY_SLUG = os.getenv("PAID_COMMUNITY_SLUG", "").strip()
SKAPI_BASE_URL = os.getenv("SKAPI_BASE_URL", "https://api.skapi.pro").rstrip("/")
SKAPI_ADMIN_SECRET = os.getenv("SKAPI_ADMIN_SECRET", "").strip()

_TZ = zoneinfo.ZoneInfo(DISPLAY_TIMEZONE)
TAILSCALE_NET = ipaddress.ip_network("100.64.0.0/10")

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool | None:
    """Ленивый пул подключений к общей PostgreSQL."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            return None
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


_settings_init = False


async def _ensure_settings_table(pool: asyncpg.Pool) -> None:
    """Создаёт таблицу настроек дашборда (идемпотентно, один раз на процесс)."""
    global _settings_init
    if _settings_init:
        return
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dashboard_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    _settings_init = True


async def get_saved_setting(key: str) -> str | None:
    """Значение настройки из dashboard_settings или None."""
    pool = await get_pool()
    if pool is None:
        return None
    await _ensure_settings_table(pool)
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT value FROM dashboard_settings WHERE key = $1", key)
    return row["value"] if row else None


async def save_setting(key: str, value: str) -> None:
    """Upsert настройки в dashboard_settings."""
    pool = await get_pool()
    if pool is None:
        return
    await _ensure_settings_table(pool)
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO dashboard_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
            key, value,
        )


async def get_community_slug() -> str:
    """Slug платного сообщества: сохранённый в БД, иначе env PAID_COMMUNITY_SLUG."""
    saved = await get_saved_setting("community_slug")
    return (saved or PAID_COMMUNITY_SLUG).strip()


def _is_allowed(ip_str: str) -> bool:
    """Tailscale / localhost / private — allowed. Остальные — 404."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_loopback or ip in TAILSCALE_NET or ip.is_private
    except ValueError:
        return False


def _client_ip(request: Request) -> str:
    return request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")


def to_local_str(dt) -> str | None:
    """UTC datetime → 'dd.mm HH:MM' в локальной зоне."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_TZ).strftime("%d.%m %H:%M")


def _local_now() -> str:
    return datetime.now(_TZ).strftime("%d.%m %H:%M")


DEFAULT_EXCLUDE = "04b02f5028534735ae60bf414465b766"  # Oleg (владелец) — не учитывать в статистике


async def get_exclude_ids() -> list[str]:
    """skool_user_id для исключения из статистики: настройка exclude_user_ids (csv), иначе владелец."""
    saved = await get_saved_setting("exclude_user_ids")
    raw = saved if saved is not None else DEFAULT_EXCLUDE
    return [s.strip() for s in raw.split(",") if s.strip()]


# ═══════════════════════════════════════════════════════
# SQL — денежные стадии (единый источник, как в app/community_membership.py)
# ═══════════════════════════════════════════════════════

STATE_SQL = f"""
WITH m AS (
    SELECT skool_user_id FROM community_members
    WHERE is_current = TRUE AND community_slug = $1
),
le AS (
    SELECT DISTINCT skool_user_id FROM membership_events
    WHERE event_type = 'left' AND community_slug = $1
),
comp AS (
    SELECT skool_user_id FROM community_members
    WHERE comp = TRUE AND community_slug = $1
),
agg AS (
    -- Дедупликация: один skool-аккаунт = несколько JWT-строк (перелогины).
    -- Триал считается по СУММЕ постов всех токенов — как реально потрачено.
    SELECT
        MIN(id) AS id,
        user_id AS skool_user_id,
        COUNT(*) AS tokens,
        SUM(COALESCE(posts_used, 0)) AS posts_used,
        COALESCE(SUM(posts_total), 0) AS posts_total,
        MIN(created_at) AS created_at,
        MAX(last_seen_at) AS last_seen_at
    FROM users
    WHERE user_id IS NOT NULL AND user_id <> '' AND user_id <> ALL($2::text[])
    GROUP BY user_id
),
mem AS (
    SELECT DISTINCT ON (skool_user_id)
        skool_user_id, username, name, avatar_url, profile_url, first_seen_at, left_at, comp
    FROM community_members
    WHERE community_slug = $1
    ORDER BY skool_user_id, first_seen_at DESC
)
SELECT
    a.id,
    a.skool_user_id,
    COALESCE(NULLIF(mem.name, ''), NULLIF(u.display_name, ''), mem.username, a.skool_user_id) AS display_name,
    mem.username,
    mem.avatar_url,
    a.tokens,
    a.posts_used,
    a.posts_total,
    a.created_at,
    a.last_seen_at,
    mem.comp,
    mem.first_seen_at AS joined_at,
    mem.left_at,
    COALESCE(
        us.custom_quota_limit,
        CASE lower(COALESCE(us.metadata->>'plan', 'free'))
            WHEN 'pro' THEN 500
            WHEN 'vip' THEN 2000
            ELSE 100
        END,
        100
    ) AS quota_limit,
    CASE
        WHEN m.skool_user_id IS NOT NULL OR comp.skool_user_id IS NOT NULL THEN 'subscribed'
        WHEN le.skool_user_id IS NOT NULL THEN 'churned'
        WHEN a.posts_used >= {TRIAL_POSTS_LIMIT} THEN 'trial_expired'
        ELSE 'trial'
    END AS state
FROM agg a
LEFT JOIN mem ON mem.skool_user_id = a.skool_user_id
LEFT JOIN users u ON u.id = a.id
LEFT JOIN m ON m.skool_user_id = a.skool_user_id
LEFT JOIN comp ON comp.skool_user_id = a.skool_user_id
LEFT JOIN le ON le.skool_user_id = a.skool_user_id
LEFT JOIN user_settings us ON us.user_id = a.id
"""

MONTH_USAGE_SQL = """
SELECT user_id, COUNT(*) AS c FROM api_requests
WHERE user_id IS NOT NULL AND created_at >= date_trunc('month', NOW())
GROUP BY user_id
"""


# ═══════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.get("/health")
async def health(request: Request):
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    return {"status": "ok", "time": _local_now()}


@app.get("/api/dashboard-stats")
async def dashboard_stats(request: Request, days: int = 30):
    """Агрегированные KPI: юзеры, запросы, стадии, конверсия, MRR, серии."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}

    slug = await get_community_slug()
    exclude = await get_exclude_ids()
    async with pool.acquire() as conn:
        rows = await conn.fetch(STATE_SQL, slug, exclude)
        total = len(rows)
        counts = {"trial": 0, "subscribed": 0, "trial_expired": 0, "churned": 0}
        for r in rows:
            counts[r["state"]] += 1

        active_24h = await conn.fetchval(
            "SELECT COUNT(DISTINCT u2.user_id) FROM api_requests ar "
            "JOIN users u2 ON u2.id = ar.user_id "
            "WHERE ar.created_at > NOW() - INTERVAL '24 hours' "
            "AND u2.user_id <> ALL($1::text[])",
            exclude,
        )
        requests_today = await conn.fetchval(
            "SELECT COUNT(*) FROM api_requests ar "
            "WHERE ar.created_at::date = CURRENT_DATE "
            "AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.id = ar.user_id AND u2.user_id = ANY($1::text[]))",
            exclude,
        )
        requests_this_month = await conn.fetchval(
            "SELECT COUNT(*) FROM api_requests ar "
            "WHERE ar.created_at >= date_trunc('month', NOW()) "
            "AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.id = ar.user_id AND u2.user_id = ANY($1::text[]))",
            exclude,
        )
        made_request = await conn.fetchval(
            "SELECT COUNT(DISTINCT ar.user_id) FROM api_requests ar "
            "JOIN users u2 ON u2.id = ar.user_id "
            "WHERE ar.user_id IS NOT NULL AND u2.user_id <> ALL($1::text[])",
            exclude,
        )
        req_rows = await conn.fetch(
            "SELECT user_id, COUNT(*) AS c FROM api_requests WHERE user_id IS NOT NULL GROUP BY user_id"
        )
        req_map = {r["user_id"]: r["c"] for r in req_rows}
        month_map = {r["user_id"]: r["c"] for r in month_usage}
        ai_this_month = await conn.fetchval(
            "SELECT COUNT(*) FROM ai_generations WHERE created_at >= date_trunc('month', NOW())"
        )
        generations_total = await conn.fetchval(
            "SELECT COALESCE(SUM(posts_total), 0) FROM users "
            "WHERE user_id IS NOT NULL AND user_id <> ALL($1::text[])",
            exclude,
        )

        daily_new = await conn.fetch(
            "SELECT created_at::date AS d, COUNT(DISTINCT user_id) AS c FROM users "
            "WHERE created_at >= NOW() - INTERVAL '30 days' AND user_id IS NOT NULL "
            "AND user_id <> ALL($1::text[]) "
            "GROUP BY created_at::date ORDER BY d",
            exclude,
        )
        joined_per_day = await conn.fetch(
            "SELECT detected_at::date AS d, COUNT(*) AS c FROM membership_events "
            "WHERE event_type = 'joined' AND community_slug = $1 "
            "AND detected_at >= NOW() - INTERVAL '30 days' "
            "GROUP BY detected_at::date ORDER BY d",
            slug,
        )
        members_over_time = await conn.fetch(
            "SELECT detected_at::date AS d, event_type, COUNT(*) AS c FROM membership_events "
            "WHERE community_slug = $1 AND detected_at >= NOW() - INTERVAL '90 days' "
            "GROUP BY detected_at::date, event_type ORDER BY d",
            slug,
        )
        daily_rows = await conn.fetch(
            """
            SELECT d::date AS day,
                (SELECT COUNT(*) FROM users u WHERE u.created_at::date = d::date
                   AND u.user_id IS NOT NULL AND u.user_id <> ALL($2::text[])) AS new_users,
                (SELECT COUNT(*) FROM api_requests ar WHERE ar.created_at::date = d::date
                   AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.id = ar.user_id AND u2.user_id = ANY($2::text[]))) AS requests,
                (SELECT COUNT(*) FROM ai_generations g WHERE g.created_at::date = d::date
                   AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.id = g.user_id AND u2.user_id = ANY($2::text[]))) AS ai_requests,
                (SELECT COUNT(*) FROM scheduled_posts sp WHERE sp.status = 'published'
                   AND sp.published_at::date = d::date
                   AND (sp.user_id IS NULL OR sp.user_id <> ALL($2::text[]))) AS posts_published,
                (SELECT COUNT(*) FROM membership_events e WHERE e.community_slug = $1
                   AND e.event_type = 'joined' AND e.detected_at::date = d::date) AS joined,
                (SELECT COUNT(*) FROM membership_events e WHERE e.community_slug = $1
                   AND e.event_type = 'left' AND e.detected_at::date = d::date) AS left
            FROM generate_series(CURRENT_DATE - ($3::int - 1), CURRENT_DATE, INTERVAL '1 day') d
            ORDER BY day DESC
            """,
            slug,
            exclude,
            max(7, min(int(days), 90)),
        )
        sched_rows = await conn.fetch(
            "SELECT status, COUNT(*) AS c FROM scheduled_posts GROUP BY status"
        )
        sched_map = {r["status"]: r["c"] for r in sched_rows}
        scheduled = {
            "total": sum(sched_map.values()),
            "pending": sched_map.get("pending", 0),
            "published": sched_map.get("published", 0),
            "failed": sched_map.get("failed", 0),
        }

    conv_denom = counts["subscribed"] + counts["trial_expired"]
    conversion = round(counts["subscribed"] / conv_denom * 100, 1) if conv_denom else 0.0
    over_quota = sum(
        1 for r in rows if month_map.get(r["id"], 0) > (r["quota_limit"] or 100)
    )

    return {
        "total_users": total,
        "made_request": made_request or 0,
        "active_24h": active_24h or 0,
        "requests_today": requests_today or 0,
        "requests_this_month": requests_this_month or 0,
        "ai_this_month": ai_this_month or 0,
        "generations_total": generations_total or 0,
        "users_over_quota": over_quota,
        "scheduled_posts": scheduled,
        "states": counts,
        "conversion_rate": conversion,
        "mrr_estimate": round(counts["subscribed"] * COMMUNITY_PRICE, 2),
        "daily_new_users": {str(r["d"]): r["c"] for r in daily_new},
        "daily_new_subscribers": {str(r["d"]): r["c"] for r in joined_per_day},
        "members_over_time": [
            {"date": str(r["d"]), "event_type": r["event_type"], "count": r["c"]}
            for r in members_over_time
        ],
        "trial_posts": TRIAL_POSTS_LIMIT,
        "community_price": COMMUNITY_PRICE,
        "community_slug": slug,
        "daily": [
            {
                "date": str(r["day"]),
                "new_users": r["new_users"],
                "requests": r["requests"],
                "ai_requests": r["ai_requests"],
                "posts_published": r["posts_published"],
                "joined": r["joined"],
                "left": r["left"],
            }
            for r in daily_rows
        ],
    }


@app.get("/api/funnel")
async def funnel(request: Request):
    """Воронка: Seen → Made request → Trial active → Subscribed (+expired/churned)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    slug = await get_community_slug()
    async with pool.acquire() as conn:
        exclude = await get_exclude_ids()
        rows = await conn.fetch(STATE_SQL, slug, exclude)
        counts = {"trial": 0, "subscribed": 0, "trial_expired": 0, "churned": 0}
        for r in rows:
            counts[r["state"]] += 1
        made_request = await conn.fetchval(
            "SELECT COUNT(DISTINCT ar.user_id) FROM api_requests ar "
            "JOIN users u2 ON u2.id = ar.user_id "
            "WHERE ar.user_id IS NOT NULL AND u2.user_id <> ALL($1::text[])",
            await get_exclude_ids(),
        )
    return {
        "total": len(rows),
        "made_request": made_request or 0,
        "trial_active": counts["trial"],
        "subscribed": counts["subscribed"],
        "trial_expired": counts["trial_expired"],
        "churned": counts["churned"],
    }


@app.get("/api/dashboard-users")
async def dashboard_users(
    request: Request,
    state: str = "",
    active_hours: int = 0,
    has_requests: int = 0,
    limit: int = 100,
    offset: int = 0,
):
    """Список пользователей; фильтры: state, активность за N часов, наличие запросов."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}

    state = state.strip().lower()
    conds = []
    if state in ("trial", "subscribed", "trial_expired", "churned"):
        conds.append(f"state = '{state}'")
    if active_hours > 0:
        conds.append(
            f"EXISTS (SELECT 1 FROM api_requests ar JOIN users u2 ON u2.id = ar.user_id "
            f"WHERE u2.user_id = t.skool_user_id "
            f"AND ar.created_at >= NOW() - INTERVAL '{min(int(active_hours), 720)} hours')"
        )
    if has_requests:
        conds.append(
            "EXISTS (SELECT 1 FROM api_requests ar JOIN users u2 ON u2.id = ar.user_id "
            "WHERE u2.user_id = t.skool_user_id)"
        )
    where = ("WHERE " + " AND ".join(conds)) if conds else ""

    slug = await get_community_slug()
    exclude = await get_exclude_ids()
    sql = f"SELECT * FROM ({STATE_SQL}) t {where} ORDER BY t.created_at DESC LIMIT $3 OFFSET $4"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, slug, exclude, limit, offset)
        req_rows = await conn.fetch(
            "SELECT user_id, COUNT(*) AS c, MAX(created_at) AS last FROM api_requests "
            "WHERE user_id IS NOT NULL GROUP BY user_id"
        )
        req_map = {r["user_id"]: {"total": r["c"], "last": r["last"]} for r in req_rows}
        month_rows = await conn.fetch(MONTH_USAGE_SQL)
        month_map = {r["user_id"]: r["c"] for r in month_rows}
        today_rows = await conn.fetch(
            "SELECT user_id, COUNT(*) AS c FROM api_requests "
            "WHERE created_at::date = CURRENT_DATE GROUP BY user_id"
        )
        today_map = {r["user_id"]: r["c"] for r in today_rows}
        banned_rows = await conn.fetch("SELECT user_id FROM users WHERE is_banned")
        banned_set = {r["user_id"] for r in banned_rows}

    users = []
    for r in rows:
        quota_used = month_map.get(r["id"], 0)
        quota_limit = r["quota_limit"] or 100
        users.append({
            "id": r["id"],
            "skool_user_id": r["skool_user_id"],
            "display_name": r["display_name"] or r["skool_user_id"],
            "username": r["username"],
            "avatar_url": r["avatar_url"],
            "tokens": r["tokens"],
            "posts_total": r["posts_total"] or 0,
            "created_at": to_local_str(r["created_at"]),
            "last_active_at": to_local_str(r["last_seen_at"]),
            "joined_at": to_local_str(r["joined_at"]),
            "left_at": to_local_str(r["left_at"]),
            "state": r["state"],
            "posts_used": r["posts_used"] or 0,
            "posts_limit": TRIAL_POSTS_LIMIT,
            "is_banned": r["skool_user_id"] in banned_set,
            "requests_today": today_map.get(r["id"], 0),
            "requests_total": req_map.get(r["id"], {}).get("total", 0),
            "quota_used": quota_used,
            "quota_limit": quota_limit,
            "quota_percent": round(quota_used / quota_limit * 100, 1) if quota_limit else 0,
        })
    return {"users": users, "total": len(users)}


@app.get("/api/users/{skool_user_id}")
async def user_detail(skool_user_id: str, request: Request):
    """Детали: все JWT-токены аккаунта, членство (снимок+comp), посты, запросы, аудит."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    slug = await get_community_slug()
    async with pool.acquire() as conn:
        agg = await conn.fetchrow(
            "SELECT COUNT(*) AS tokens, SUM(COALESCE(posts_used, 0)) AS posts_used, "
            "COALESCE(SUM(posts_total), 0) AS posts_total, MIN(created_at) AS created_at, "
            "MAX(last_seen_at) AS last_seen_at, BOOL_OR(is_banned) AS is_banned, "
            "(ARRAY_AGG(lang ORDER BY last_seen_at DESC NULLS LAST))[1] AS lang "
            "FROM users WHERE user_id = $1",
            skool_user_id,
        )
        if agg is None or agg["tokens"] == 0:
            return JSONResponse(status_code=404, content={"detail": "User not found"})
        member = await conn.fetchrow(
            "SELECT name, username, avatar_url, profile_url, first_seen_at, is_current, comp, left_at "
            "FROM community_members WHERE skool_user_id = $1 AND community_slug = $2 "
            "ORDER BY first_seen_at DESC LIMIT 1",
            skool_user_id, slug,
        )
        events = await conn.fetch(
            "SELECT * FROM membership_events WHERE skool_user_id = $1 "
            "ORDER BY detected_at DESC LIMIT 50",
            skool_user_id,
        )
        req_rows = await conn.fetch(
            "SELECT endpoint, status_code, success, created_at FROM api_requests "
            "WHERE user_id IN (SELECT id FROM users WHERE user_id = $1) "
            "ORDER BY created_at DESC LIMIT 50",
            skool_user_id,
        )
        req_total = await conn.fetchval(
            "SELECT COUNT(*) FROM api_requests "
            "WHERE user_id IN (SELECT id FROM users WHERE user_id = $1)",
            skool_user_id,
        )
        sched_rows = await conn.fetch(
            "SELECT id, COALESCE(NULLIF(title, ''), LEFT(content, 80)) AS title, status, "
            "scheduled_for, published_at, published_url, error_message "
            "FROM scheduled_posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
            skool_user_id,
        )
        admin_actions = await conn.fetch(
            "SELECT action, details, created_at FROM dashboard_admin_actions "
            "WHERE skool_user_id = $1 ORDER BY created_at DESC LIMIT 20",
            skool_user_id,
        )
    return {
        "skool_user_id": skool_user_id,
        "display_name": (member["name"] if member else None) or "",
        "username": member["username"] if member else None,
        "avatar_url": member["avatar_url"] if member else None,
        "profile_url": member["profile_url"] if member else None,
        "tokens": agg["tokens"],
        "created_at": to_local_str(agg["created_at"]),
        "last_seen_at": to_local_str(agg["last_seen_at"]),
        "is_banned": agg["is_banned"],
        "posts_used": agg["posts_used"] or 0,
        "posts_total": agg["posts_total"] or 0,
        "lang": agg["lang"],
        "member": {
            "name": member["name"],
            "username": member["username"],
            "avatar_url": member["avatar_url"],
            "profile_url": member["profile_url"],
            "is_current": member["is_current"],
            "comp": member["comp"],
            "first_seen_at": to_local_str(member["first_seen_at"]),
            "left_at": to_local_str(member["left_at"]),
        } if member else None,
        "requests_total": req_total or 0,
        "scheduled_posts": [
            {
                "id": s["id"],
                "title": s["title"],
                "status": s["status"],
                "scheduled_for": to_local_str(s["scheduled_for"]),
                "published_at": to_local_str(s["published_at"]),
                "published_url": s["published_url"],
                "error": (s["error_message"] or "")[:200],
            }
            for s in sched_rows
        ],
        "membership_events": [
            {
                "event_type": e["event_type"],
                "detected_at": to_local_str(e["detected_at"]),
                "community_slug": e["community_slug"],
            }
            for e in events
        ],
        "recent_requests": [
            {
                "endpoint": r["endpoint"],
                "status_code": r["status_code"],
                "success": r["success"],
                "created_at": to_local_str(r["created_at"]),
            }
            for r in req_rows
        ],
        "admin_actions": [
            {
                "action": a["action"],
                "details": a["details"],
                "created_at": to_local_str(a["created_at"]),
            }
            for a in admin_actions
        ],
    }


# ═══════════════════════════════════════════════════════
# РУЧНОЕ УПРАВЛЕНИЕ: триал, бан, аудит
# ═══════════════════════════════════════════════════════

_admin_init = False


async def _ensure_admin_table(pool) -> None:
    """Журнал ручных действий (идемпотентно, один раз на процесс)."""
    global _admin_init
    if _admin_init:
        return
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dashboard_admin_actions (
                id SERIAL PRIMARY KEY,
                skool_user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    _admin_init = True


@app.post("/api/users/{skool_user_id}/posts-adjust")
async def posts_adjust(skool_user_id: str, request: Request):
    """Ручной триал: reset — снова полные N постов; revoke — досрочно исчерпан;
    bonus N — подарить N постов (уменьшить счётчик)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    body = await request.json()
    action = (body.get("action") or "").strip().lower()
    posts = max(0, int(body.get("posts") or 0))
    if action == "reset":
        sql = "UPDATE users SET posts_used = 0 WHERE user_id = $1 RETURNING posts_used"
        details = "сброс счётчика триала"
    elif action == "revoke":
        sql = f"UPDATE users SET posts_used = {int(TRIAL_POSTS_LIMIT)} WHERE user_id = $1 RETURNING posts_used"
        details = "триал досрочно исчерпан"
    elif action == "bonus" and posts > 0:
        sql = "UPDATE users SET posts_used = GREATEST(0, posts_used - $2) WHERE user_id = $1 RETURNING posts_used"
        details = f"бонус: +{posts} постов"
    else:
        return JSONResponse(status_code=400, content={"detail": "bad action"})
    await _ensure_admin_table(pool)
    async with pool.acquire() as conn:
        if action == "bonus":
            row = await conn.fetchrow(sql, skool_user_id, posts)
        else:
            row = await conn.fetchrow(sql, skool_user_id)
        if row is None:
            return JSONResponse(status_code=404, content={"detail": "User not found"})
        await conn.execute(
            "INSERT INTO dashboard_admin_actions (skool_user_id, action, details) VALUES ($1, $2, $3)",
            skool_user_id, f"posts_{action}", details,
        )
    return {"success": True, "posts_used": row["posts_used"], "posts_limit": TRIAL_POSTS_LIMIT}


@app.post("/api/users/{skool_user_id}/ban")
async def set_banned(skool_user_id: str, request: Request):
    """Бан/разбан: is_banned=True блокирует /ai/* (check_access → banned)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    body = await request.json()
    banned = bool(body.get("banned"))
    reason = (body.get("reason") or ("dashboard: ручная блокировка" if banned else "")).strip()
    await _ensure_admin_table(pool)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE users SET is_banned = $2, ban_reason = $3 WHERE user_id = $1 RETURNING is_banned",
            skool_user_id, banned, reason if banned else None,
        )
        if row is None:
            return JSONResponse(status_code=404, content={"detail": "User not found"})
        await conn.execute(
            "INSERT INTO dashboard_admin_actions (skool_user_id, action, details) VALUES ($1, $2, $3)",
            skool_user_id, "ban" if banned else "unban",
            reason if banned else "разблокировка",
        )
    return {"success": True, "is_banned": row["is_banned"]}


@app.post("/api/users/{skool_user_id}/subscribe")
async def set_comp_subscription(skool_user_id: str, request: Request):
    """Комплимент-подписка без оплаты: comp=TRUE в community_members.
    Даёт 'subscribed' и отключает ватермарк (is_current_member учитывает comp)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    body = await request.json()
    comp = bool(body.get("comp"))
    slug = await get_community_slug()
    if not slug:
        return JSONResponse(status_code=400, content={"detail": "community_slug not set"})
    await _ensure_admin_table(pool)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO community_members (community_slug, skool_user_id, is_current, comp, last_seen_at)
            VALUES ($1, $2, $3, $3, NOW())
            ON CONFLICT (community_slug, skool_user_id)
            DO UPDATE SET comp = EXCLUDED.comp, last_seen_at = NOW()
            RETURNING comp
            """,
            slug, skool_user_id, comp,
        )
        await conn.execute(
            "INSERT INTO dashboard_admin_actions (skool_user_id, action, details) VALUES ($1, $2, $3)",
            skool_user_id, "comp_grant" if comp else "comp_revoke",
            f"комплимент-подписка {'выдана' if comp else 'отозвана'} ({slug})",
        )
    return {"success": True, "comp": row["comp"]}


@app.get("/api/group-info")
async def group_info(request: Request):
    """Публичная инфа о группе через Skapi /check-group (без JWT)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    slug = await get_community_slug()
    if not slug:
        return {"error": "community_slug not set"}
    url = slug if slug.startswith("http") else f"https://www.skool.com/{slug}"
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r = await client.post(f"{SKAPI_BASE_URL}/check-group", json={"group": url})
        data = r.json()
    except Exception as e:
        return {"error": f"skapi unreachable: {e}"}
    if "detail" in data:
        return {"error": data["detail"], "slug": slug}
    return {"success": True, "slug": slug, "checked_at": data.get("timestamp"), "group": data.get("result", {})}


@app.get("/api/posts")
async def posts_feed(request: Request, limit: int = 50):
    """Последние отложенные посты — что происходит с публикациями."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    slug = await get_community_slug()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.id, s.user_id, COALESCE(NULLIF(s.title, ''), LEFT(s.content, 80)) AS title,
                   s.community_slug, s.language, s.status, s.scheduled_for, s.published_at,
                   s.published_url, s.error_message,
                   m.name AS author_name, m.username AS author_username, m.avatar_url AS author_avatar
            FROM scheduled_posts s
            LEFT JOIN LATERAL (
                SELECT c.name, c.username, c.avatar_url FROM community_members c
                WHERE c.skool_user_id = s.user_id AND c.community_slug = $2
                ORDER BY c.last_seen_at DESC NULLS LAST LIMIT 1
            ) m ON TRUE
            ORDER BY s.created_at DESC LIMIT $1
            """,
            min(limit, 200),
            slug,
        )
    return {
        "posts": [
            {
                "id": r["id"],
                "user_id": r["user_id"],
                "author_name": r["author_name"],
                "author_username": r["author_username"],
                "author_avatar": r["author_avatar"],
                "title": r["title"],
                "community_slug": r["community_slug"],
                "language": r["language"],
                "status": r["status"],
                "scheduled_for": to_local_str(r["scheduled_for"]),
                "published_at": to_local_str(r["published_at"]),
                "published_url": r["published_url"],
                "error": (r["error_message"] or "")[:200],
            }
            for r in rows
        ]
    }


@app.get("/api/membership-events")
async def membership_events(request: Request, limit: int = 30):
    """Лента последних join/leave."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    async with pool.acquire() as conn:
        slug = await get_community_slug()
        rows = await conn.fetch(
            """
            SELECT e.id, e.community_slug, e.skool_user_id, e.event_type, e.detected_at,
                   COALESCE(NULLIF(m.name, ''), NULLIF(e.name, '')) AS name,
                   COALESCE(NULLIF(m.username, ''), NULLIF(e.username, '')) AS username
            FROM membership_events e
            LEFT JOIN LATERAL (
                SELECT c.name, c.username FROM community_members c
                WHERE c.skool_user_id = e.skool_user_id AND c.community_slug = $2
                ORDER BY c.last_seen_at DESC NULLS LAST LIMIT 1
            ) m ON TRUE
            WHERE e.community_slug = $2
            ORDER BY e.detected_at DESC LIMIT $1
            """,
            limit,
            slug,
        )
    return {
        "events": [
            {
                "id": r["id"],
                "community_slug": r["community_slug"],
                "skool_user_id": r["skool_user_id"],
                "username": r["username"],
                "name": r["name"],
                "event_type": r["event_type"],
                "detected_at": to_local_str(r["detected_at"]),
            }
            for r in rows
        ]
    }


@app.get("/api/sync-status")
async def sync_status(request: Request):
    """Последний запуск синхронизации."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    async with pool.acquire() as conn:
        slug = await get_community_slug()
        row = await conn.fetchrow(
            "SELECT * FROM sync_runs WHERE community_slug = $1 ORDER BY started_at DESC LIMIT 1",
            slug,
        )
    if row is None:
        return {"sync": None}
    return {
        "sync": {
            "id": row["id"],
            "community_slug": row["community_slug"],
            "started_at": to_local_str(row["started_at"]),
            "finished_at": to_local_str(row["finished_at"]),
            "status": row["status"],
            "members_found": row["members_found"],
            "joined_count": row["joined_count"],
            "left_count": row["left_count"],
            "error": row["error"],
            "triggered_by": row["triggered_by"],
        }
    }


FIN_DEFAULTS = {
    "ai_price_input": 0.6,    # $ за 1М входных токенов (GLM-4.7, поправьте под тариф Z.ai)
    "ai_price_output": 2.2,   # $ за 1М выходных токенов
    "avg_tokens_in": 1500,    # средний промпт генерации
    "avg_tokens_out": 800,    # средний ответ генерации
    "infra_cost": 10.0,       # $/мес VPS + домен
}


async def get_finance_settings() -> dict:
    """Финансовые константы: dashboard_settings (fin_*) с дефолтами."""
    result = dict(FIN_DEFAULTS)
    for key in FIN_DEFAULTS:
        saved = await get_saved_setting(f"fin_{key}")
        if saved is not None:
            try:
                result[key] = float(saved)
            except ValueError:
                pass
    return result


@app.get("/api/settings")
async def get_settings(request: Request):
    """Сохранённые настройки дашборда (community_slug, финансы)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    slug = await get_community_slug()
    saved = await get_saved_setting("community_slug")
    finance = await get_finance_settings()
    return {
        "community_slug": slug,
        "source": "saved" if saved else "env",
        "trial_posts": TRIAL_POSTS_LIMIT,
        "community_price": COMMUNITY_PRICE,
        "finance": finance,
    }


@app.post("/api/settings")
async def post_settings(request: Request):
    """Сохранить community_slug и/или финансовые константы (upsert в dashboard_settings)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"success": False, "error": "invalid JSON"})

    slug = (body.get("community_slug") or "").strip().rstrip("/")
    finance = body.get("finance")
    if not slug and not finance:
        return JSONResponse(status_code=400, content={"success": False, "error": "nothing to save"})

    if slug:
        await save_setting("community_slug", slug)
    if isinstance(finance, dict):
        for key in FIN_DEFAULTS:
            if key in finance:
                try:
                    val = max(0.0, float(finance[key]))
                except (TypeError, ValueError):
                    return JSONResponse(status_code=400, content={"success": False, "error": f"{key}: not a number"})
                await save_setting(f"fin_{key}", str(val))
    return {"success": True, "community_slug": slug or None, "finance": await get_finance_settings()}


@app.post("/api/sync-trigger")
async def sync_trigger(request: Request):
    """Проксирует ручной запуск синхронизации в Skapi backend."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if not SKAPI_ADMIN_SECRET:
        return {"success": False, "error": "SKAPI_ADMIN_SECRET not configured"}
    slug = await get_community_slug()
    if not slug:
        return {"success": False, "error": "community slug not configured — укажите slug в панели синхронизации"}
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f"{SKAPI_BASE_URL}/admin/sync-community-members",
            params={"admin_key": SKAPI_ADMIN_SECRET, "community_slug": slug},
        )
    try:
        inner = resp.json()
    except Exception:
        return {"success": False, "error": f"Skapi responded {resp.status_code}"}
    # inner: {"success": bool, ...} — успех только если сам sync удался
    if not inner.get("success", False):
        return {"success": False, "error": inner.get("error") or f"sync failed: {inner}"}
    return {"success": True, "result": inner}


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    """React SPA entry point."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return "<h1>Frontend not built. Run: cd frontend && npm run build</h1>"


if __name__ == "__main__":
    import uvicorn

    print(f"🚀 Magic Writer Dashboard starting on port {PORT}...")
    print(f"   URL: http://<tailscale-ip>:{PORT}/dashboard")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
