from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request

from api.routes.counselor import router as counselor_router
from api.routes.health import router as health_router
from api.routes.analytics import router as analytics_router
from api.routes.cost_calculator import router as cost_calculator_router
from api.routes.decision import router as decision_router
from api.routes.rankings import router as rankings_router
from api.routes.semantic_search import router as semantic_search_router
from api.routes.sensitivity import router as sensitivity_router
from api.routes.schools import router as schools_router
from core.config import get_settings
from core.errors import register_exception_handlers
from core.logging import configure_logging


# ponytail: a middleware function, not a Starlette middleware class. Four static
# headers do not need a class, and this is a JSON API - no CSP, because there is no
# document to protect. Add one if the API ever serves HTML.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
}


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    # Interactive docs are a development convenience; a deployed API does not advertise its surface.
    docs_enabled = settings.app_env.lower() in {"development", "dev", "local", "test"}
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Deterministic college ranking, search, and decision-support API.",
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )
    if settings.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_credentials=False,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
        )
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        if request.url.path.startswith("/counselor/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(counselor_router)
    app.include_router(health_router)
    app.include_router(schools_router)
    app.include_router(rankings_router)
    app.include_router(semantic_search_router)
    app.include_router(decision_router)
    app.include_router(cost_calculator_router)
    app.include_router(sensitivity_router)
    app.include_router(analytics_router)
    register_exception_handlers(app)
    return app


app = create_app()
