"""
Analytics Dashboard Backend — FastAPI Stub

Этот файл — отправная точка для нового дашборда.
Копируй, адаптируй, подключай источник данных.

Запуск:
    uvicorn api_stub:app --reload --port 8000

Доступ:
    http://100.x.y.z:8000/dashboard  (через Tailscale)
"""
import os
import ipaddress
import zoneinfo
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI(title="Analytics Dashboard")

# ═══════════════════════════════════════════════════════
# CONFIG — измени под свой проект
# ═══════════════════════════════════════════════════════

DISPLAY_TIMEZONE = os.getenv("DISPLAY_TIMEZONE", "Europe/Vienna")
_PORT = int(os.getenv("PORT", "8000"))

# ═══════════════════════════════════════════════════════
# FRONTEND STATIC FILES
# ═══════════════════════════════════════════════════════

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

# ═══════════════════════════════════════════════════════
# SECURITY — IP filtering (Tailscale only)
# ═══════════════════════════════════════════════════════

TAILSCALE_NET = ipaddress.ip_network("100.64.0.0/10")


def _get_client_ip(request: Request) -> str:
    """Реальный IP: X-Real-IP (nginx) → client.host."""
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def _is_allowed(ip_str: str) -> bool:
    """Tailscale / localhost / Docker internal — allowed. Остальные — 404."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_loopback or ip in TAILSCALE_NET or ip.is_private
    except ValueError:
        return False


# ═══════════════════════════════════════════════════════
# TIMEZONE HELPER
# ═══════════════════════════════════════════════════════

_TZ = zoneinfo.ZoneInfo(DISPLAY_TIMEZONE)
_UTC = zoneinfo.ZoneInfo("UTC")


def to_local_str(dt) -> str | None:
    """UTC datetime → 'dd.mm HH:MM' в локальной зоне."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_UTC)
    return dt.astimezone(_TZ).strftime("%d.%m %H:%M")


def local_now_str() -> str:
    return datetime.now(_TZ).strftime("%d.%m %H:%M")


# ═══════════════════════════════════════════════════════
# DATE PARSING
# ═══════════════════════════════════════════════════════

def parse_date_range(from_date: str | None, to_date: str | None):
    """
    → (start, end) datetime objects.
    Если from_date > to_date — swap.
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    if from_date:
        try:
            start = datetime.strptime(from_date, "%Y-%m-%d")
        except ValueError:
            start = today_start
    else:
        start = today_start

    if to_date:
        try:
            end = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            end = today_start + timedelta(days=1)
    else:
        end = today_start + timedelta(days=1)

    # Swap if inverted
    if start > end:
        start, end = end, start

    return start, end


# ═══════════════════════════════════════════════════════
# DATA SOURCE — подключи свой адаптер здесь
# ═══════════════════════════════════════════════════════
#
# Варианты (см. docs/04-data-sources.md):
#   1. PostgreSQL → SQLAlchemy (раскомментируй ниже)
#   2. Google Sheets → gspread
#   3. Airtable → pyairtable
#   4. Mock → заглушка для разработки (текущий вариант)
#

import random


def _mock_stats(start, end) -> dict:
    """Mock data для фронтенд-разработки без БД."""
    total = random.randint(100, 300)
    new = random.randint(5, 25)
    active = random.randint(3, 15)

    daily_new = {}
    daily_active = {}
    d = start
    while d < end:
        key = d.strftime("%Y-%m-%d")
        daily_new[key] = random.randint(0, 8)
        daily_active[key] = random.randint(2, 12)
        d += timedelta(days=1)

    return {
        "campaign_start": start.strftime("%Y-%m-%d"),
        "since_date": start.strftime("%Y-%m-%d"),
        "total_users": total,
        "new_since": new,
        "active_since": active,
        "msgs_since": active * random.randint(3, 8),
        "lang_distribution": {"ru": 45, "en": 25, "de": 15, "es": 10, "tr": 5},
        "daily_new_users": daily_new,
        "daily_active_users": daily_active,
        "kpi_bars": {
            "Новые": new,
            "Активных": active,
            "Сообщений": active * 5,
        },
    }


def _mock_users(filter_name: str, start, end) -> list[dict]:
    names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Heidi"]
    langs = ["ru", "en", "de", "es", "tr"]
    users = []
    for i in range(random.randint(3, 12)):
        dt = start + timedelta(hours=random.randint(0, int((end - start).total_seconds() / 3600)))
        users.append({
            "id": 1000 + i,
            "name": random.choice(names),
            "language": random.choice(langs),
            "created_at": to_local_str(dt),
            "last_active_at": to_local_str(dt + timedelta(minutes=random.randint(0, 120))) if random.random() > 0.3 else "—",
            "messages_sent_total": random.randint(0, 30),
            "subscription_active": random.random() > 0.8,
        })
    return users


# ── РАСКОММЕНТИРУЙ для PostgreSQL ──
# from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
# from sqlalchemy import select, func
#
# DATABASE_URL = os.getenv("DATABASE_URL")
# engine = create_async_engine(DATABASE_URL, echo=False)
# async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ═══════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "time": local_now_str()}


@app.get("/api/dashboard-stats")
async def dashboard_stats(
    request: Request,
    from_date: str = None,
    to_date: str = None,
    all_time: str = None,
):
    """Агрегированные KPI за период."""
    if not _is_allowed(_get_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    if all_time == "true":
        start = datetime(2000, 1, 1)
        end = datetime.utcnow() + timedelta(days=1)
    else:
        start, end = parse_date_range(from_date, to_date)

    # ── MOCK: замени на реальный запрос ──
    return _mock_stats(start, end)

    # ── PostgreSQL пример ──
    # async with async_session_maker() as db:
    #     total_users = await db.scalar(
    #         select(func.count(User.id))
    #     )
    #     new_since = await db.scalar(
    #         select(func.count(User.id)).where(User.created_at.between(start, end))
    #     )
    #     return {
    #         "total_users": total_users or 0,
    #         "new_since": new_since or 0,
    #         # ...
    #     }


@app.get("/api/dashboard-users")
async def dashboard_users(
    request: Request,
    filter: str = "new_since",
    from_date: str = None,
    to_date: str = None,
    active_only: bool = False,
    all_time: str = None,
):
    """Список пользователей по фильтру."""
    if not _is_allowed(_get_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    if all_time == "true":
        start = datetime(2000, 1, 1)
        end = datetime.utcnow() + timedelta(days=1)
    else:
        start, end = parse_date_range(from_date, to_date)

    # ── MOCK: замени на реальный запрос ──
    users = _mock_users(filter, start, end)

    return {"users": users, "total": len(users)}


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    """React SPA entry point."""
    if not _is_allowed(_get_client_ip(request)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return "<h1>Frontend not built. Run: cd frontend && npm run build</h1>"


# ═══════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    print(f"🚀 Dashboard starting on port {_PORT}...")
    print(f"   Dashboard URL: http://<tailscale-ip>:{_PORT}/dashboard")
    uvicorn.run(app, host="0.0.0.0", port=_PORT)
