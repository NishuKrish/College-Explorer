"""No analytics, raw body logs, persistence or cached model responses on these routes."""
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from api.deps import get_cache_service, get_db
from core.config import Settings, get_settings
from core.logging import get_logger
from core.rate_limit import client_identifier
from schemas.counselor import CounselorRequest, CounselorResponse, CounselorStatus
from services.cache import CacheService
from services.counselor import CounselorService, CounselorTools, GroqModel

router = APIRouter(prefix="/counselor", tags=["counselor"])
logger = get_logger(__name__)


def counselor_available(settings: Settings) -> bool:
    return settings.counselor_enabled and bool(settings.groq_api_key.get_secret_value().strip())


def require_counselor_access(request: Request, settings: Settings = Depends(get_settings), cache: CacheService = Depends(get_cache_service)):
    if not counselor_available(settings):
        raise HTTPException(503, "The AI counselor is not connected yet. You can still explore schools and use the preference quiz.")
    now = int(time.time())
    limits = [
        (f"counselor:minute:{client_identifier(request)}:{now // 60}", 60, 6),
        (f"counselor:daily:{now // 86400}", 86400, settings.counselor_daily_limit),
    ]
    for key, ttl, limit in limits:
        count = cache.incr_counter(key, ttl)
        if count is None:
            # AI usage is not free without limits: unlike read endpoints, fail closed.
            raise HTTPException(503, "The counselor is temporarily unavailable. Please try again later.")
        if count > limit:
            raise HTTPException(429, "The counselor's free usage limit has been reached. Please try again later.", headers={"Retry-After": str(ttl - now % ttl)})


def get_counselor_service(db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> CounselorService:
    return CounselorService(GroqModel(settings), CounselorTools(db))


@router.get("/status", response_model=CounselorStatus)
def counselor_status(settings: Settings = Depends(get_settings)):
    return CounselorStatus(available=counselor_available(settings), model=settings.counselor_model)


@router.post("/chat", response_model=CounselorResponse, dependencies=[Depends(require_counselor_access)])
def counselor_chat(body: CounselorRequest, service: CounselorService = Depends(get_counselor_service)):
    try:
        return service.chat(body)
    except HTTPException:
        raise
    except Exception:
        # Database/provider exceptions can contain student-supplied arguments. Do not log
        # exception text or traceback; operational logs deliberately record only a category.
        logger.warning("counselor_unavailable")
        raise HTTPException(503, "The counselor could not retrieve school information. Please try again later.") from None
