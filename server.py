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
    TRIAL_DAYS          — длина триала (default 7)
    COMMUNITY_PRICE     — цена подписки/мес для оценки MRR (default 0)
    SKAPI_BASE_URL      — URL Skapi backend для триггера синхронизации
    SKAPI_ADMIN_SECRET  — RATE_LIMIT_ADMIN_SECRET Skapi backend
    DISPLAY_TIMEZONE    — default Europe/Vienna
"""
import ipaddress
import os
import zoneinfo
from datetime import datetime, timedelta, timezone
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
TRIAL_DAYS = int(os.getenv("TRIAL_DAYS", "7"))
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


# ═══════════════════════════════════════════════════════
# SQL — денежные стадии (единый источник, как в app/community_membership.py)
# ═══════════════════════════════════════════════════════

STATE_SQL = f"""
WITH m AS (
    SELECT skool_user_id FROM community_members
    WHERE is_current = TRUE AND community_slug = $1
),
le AS (
    SELECT DISTINCT skool_user_id FROM membership_events WHERE event_type = 'left'
)
SELECT
    u.id,
    u.user_id AS skool_user_id,
    u.display_name,
    u.created_at,
    u.last_seen_at,
    cm.first_seen_at AS joined_at,
    cm.left_at,
    CASE
        WHEN m.skool_user_id IS NOT NULL THEN 'subscribed'
        WHEN le.skool_user_id IS NOT NULL THEN 'churned'
        WHEN u.created_at < NOW() - make_interval(days => {TRIAL_DAYS}) THEN 'trial_expired'
        ELSE 'trial'
    END AS state
FROM users u
LEFT JOIN m ON m.skool_user_id = u.user_id
LEFT JOIN le ON le.skool_user_id = u.user_id
LEFT JOIN LATERAL (
    SELECT first_seen_at, left_at FROM community_members cm2
    WHERE cm2.skool_user_id = u.user_id
    ORDER BY first_seen_at DESC LIMIT 1
) cm ON TRUE
WHERE u.user_id IS NOT NULL
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
async def dashboard_stats(request: Request):
    """Агрегированные KPI: юзеры, запросы, стадии, конверсия, MRR, серии."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}

    async with pool.acquire() as conn:
        rows = await conn.fetch(STATE_SQL, PAID_COMMUNITY_SLUG)
        total = len(rows)
        counts = {"trial": 0, "subscribed": 0, "trial_expired": 0, "churned": 0}
        for r in rows:
            counts[r["state"]] += 1

        active_24h = await conn.fetchval(
            "SELECT COUNT(*) FROM api_requests WHERE created_at > NOW() - INTERVAL '24 hours'"
        )
        requests_today = await conn.fetchval(
            "SELECT COUNT(*) FROM api_requests WHERE created_at::date = CURRENT_DATE"
        )
        made_request = await conn.fetchval(
            "SELECT COUNT(DISTINCT user_id) FROM api_requests WHERE user_id IS NOT NULL"
        )
        req_rows = await conn.fetch(
            "SELECT user_id, COUNT(*) AS c FROM api_requests WHERE user_id IS NOT NULL GROUP BY user_id"
        )
        req_map = {r["user_id"]: r["c"] for r in req_rows}

        daily_new = await conn.fetch(
            "SELECT created_at::date AS d, COUNT(*) AS c FROM users "
            "WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY created_at::date ORDER BY d"
        )
        joined_per_day = await conn.fetch(
            "SELECT detected_at::date AS d, COUNT(*) AS c FROM membership_events "
            "WHERE event_type = 'joined' AND detected_at >= NOW() - INTERVAL '30 days' "
            "GROUP BY detected_at::date ORDER BY d"
        )
        members_over_time = await conn.fetch(
            "SELECT detected_at::date AS d, event_type, COUNT(*) AS c FROM membership_events "
            "WHERE detected_at >= NOW() - INTERVAL '90 days' "
            "GROUP BY detected_at::date, event_type ORDER BY d"
        )

    conv_denom = counts["subscribed"] + counts["trial_expired"]
    conversion = round(counts["subscribed"] / conv_denom * 100, 1) if conv_denom else 0.0

    return {
        "total_users": total,
        "made_request": made_request or 0,
        "active_24h": active_24h or 0,
        "requests_today": requests_today or 0,
        "states": counts,
        "conversion_rate": conversion,
        "mrr_estimate": round(counts["subscribed"] * COMMUNITY_PRICE, 2),
        "daily_new_users": {str(r["d"]): r["c"] for r in daily_new},
        "daily_new_subscribers": {str(r["d"]): r["c"] for r in joined_per_day},
        "members_over_time": [
            {"date": str(r["d"]), "event_type": r["event_type"], "count": r["c"]}
            for r in members_over_time
        ],
        "trial_days": TRIAL_DAYS,
        "community_price": COMMUNITY_PRICE,
        "community_slug": PAID_COMMUNITY_SLUG,
    }


@app.get("/api/funnel")
async def funnel(request: Request):
    """Воронка: Seen → Made request → Trial active → Subscribed (+expired/churned)."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    async with pool.acquire() as conn:
        rows = await conn.fetch(STATE_SQL, PAID_COMMUNITY_SLUG)
        counts = {"trial": 0, "subscribed": 0, "trial_expired": 0, "churned": 0}
        for r in rows:
            counts[r["state"]] += 1
        made_request = await conn.fetchval(
            "SELECT COUNT(DISTINCT user_id) FROM api_requests WHERE user_id IS NOT NULL"
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
    limit: int = 100,
    offset: int = 0,
):
    """Список пользователей с денежной стадией; фильтр по state."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}

    state = state.strip().lower()
    where = "WHERE u.user_id IS NOT NULL"
    if state in ("trial", "subscribed", "trial_expired", "churned"):
        where += f" AND state = '{state}'"  # state — производный алиас в том же SELECT? нет — оборачиваем

    sql = f"SELECT * FROM ({STATE_SQL}) t {where} ORDER BY t.created_at DESC LIMIT $2 OFFSET $3"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, PAID_COMMUNITY_SLUG, limit, offset)
        req_rows = await conn.fetch(
            "SELECT user_id, COUNT(*) AS c, MAX(created_at) AS last FROM api_requests "
            "WHERE user_id IS NOT NULL GROUP BY user_id"
        )
        req_map = {r["user_id"]: {"total": r["c"], "last": r["last"]} for r in req_rows}
        today_rows = await conn.fetch(
            "SELECT user_id, COUNT(*) AS c FROM api_requests "
            "WHERE created_at::date = CURRENT_DATE GROUP BY user_id"
        )
        today_map = {r["user_id"]: r["c"] for r in today_rows}

    users = []
    for r in rows:
        users.append({
            "id": r["id"],
            "skool_user_id": r["skool_user_id"],
            "display_name": r["display_name"] or r["skool_user_id"],
            "created_at": to_local_str(r["created_at"]),
            "last_active_at": to_local_str(r["last_active_at"]),
            "joined_at": to_local_str(r["joined_at"]),
            "left_at": to_local_str(r["left_at"]),
            "state": r["state"],
            "trial_end": to_local_str(
                r["created_at"] + timedelta(days=TRIAL_DAYS) if r["created_at"] else None
            ),
            "requests_today": today_map.get(r["id"], 0),
            "requests_total": req_map.get(r["id"], {}).get("total", 0),
        })
    return {"users": users, "total": len(users)}


@app.get("/api/users/{skool_user_id}")
async def user_detail(skool_user_id: str, request: Request):
    """Детали пользователя: профиль, стадия, история членства, запросы."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    pool = await get_pool()
    if pool is None:
        return {"error": "DATABASE_URL not set"}
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM users WHERE user_id = $1", skool_user_id
        )
        if row is None:
            return JSONResponse(status_code=404, content={"detail": "User not found"})
        events = await conn.fetch(
            "SELECT * FROM membership_events WHERE skool_user_id = $1 "
            "ORDER BY detected_at DESC LIMIT 50",
            skool_user_id,
        )
        req_rows = await conn.fetch(
            "SELECT endpoint, status_code, success, created_at FROM api_requests "
            "WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
            row["id"],
        )
    return {
        "id": row["id"],
        "skool_user_id": row["user_id"],
        "display_name": row["display_name"],
        "client_id": row["client_id"],
        "created_at": to_local_str(row["created_at"]),
        "last_seen_at": to_local_str(row["last_seen_at"]),
        "is_banned": row["is_banned"],
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
        rows = await conn.fetch(
            "SELECT * FROM membership_events ORDER BY detected_at DESC LIMIT $1", limit
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
        row = await conn.fetchrow("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1")
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


@app.post("/api/sync-trigger")
async def sync_trigger(request: Request):
    """Проксирует ручной запуск синхронизации в Skapi backend."""
    if not _is_allowed(_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if not SKAPI_ADMIN_SECRET:
        return {"success": False, "error": "SKAPI_ADMIN_SECRET not configured"}
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            f"{SKAPI_BASE_URL}/admin/sync-community-members",
            params={"admin_key": SKAPI_ADMIN_SECRET},
        )
    try:
        return {"success": resp.status_code == 200, "result": resp.json()}
    except Exception:
        return {"success": False, "error": f"Skapi responded {resp.status_code}"}


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
