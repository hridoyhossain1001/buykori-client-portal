import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.database import engine, Base
from app.routers.events import router as events_router
from app.routers.admin import router as admin_router

# ─── Logging Setup ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ─── Lifespan: DB Table তৈরি হবে অ্যাপ স্টার্টে ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 CAPI Gateway স্টার্ট হচ্ছে...")
    async with engine.begin() as conn:
        # প্রথমবার চালালে টেবিল তৈরি হবে, পরেরবার কিছু হবে না
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ ডাটাবেস সংযোগ সফল।")
    yield
    logger.info("🛑 CAPI Gateway বন্ধ হচ্ছে...")
    await engine.dispose()


# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="CAPI Gateway",
    description="Multi-tenant Facebook Conversion API Gateway — Server-Side Tracking as a Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",         # Swagger UI
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(events_router, prefix="/api/v1", tags=["Events"])
app.include_router(admin_router,  prefix="/api/v1", tags=["Admin"])


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "running",
        "service": "CAPI Gateway",
        "version": "1.0.0",
        "message": "🔥 Server-Side Tracking Gateway চলছে!",
    }
