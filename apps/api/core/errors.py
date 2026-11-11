from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.status import HTTP_422_UNPROCESSABLE_CONTENT, HTTP_500_INTERNAL_SERVER_ERROR

from core.logging import get_logger
from schemas.errors import ErrorDetail, ErrorResponse

logger = get_logger(__name__)


def _error_response(
    status_code: int, code: str, message: str, headers: dict[str, str] | None = None
) -> JSONResponse:
    body = ErrorResponse(error=ErrorDetail(code=code, message=message))
    return JSONResponse(status_code=status_code, content=body.model_dump(), headers=headers)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    logger.info(
        "http_exception",
        extra={"path": request.url.path, "status_code": exc.status_code},
    )
    return _error_response(
        status_code=exc.status_code,
        code=f"http_{exc.status_code}",
        message=str(exc.detail),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.info(
        "validation_exception",
        extra={"path": request.url.path, "errors": [{"type": error["type"]} for error in exc.errors()]},
    )
    return _error_response(
        status_code=HTTP_422_UNPROCESSABLE_CONTENT,
        code="validation_error",
        message="Request validation failed.",
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_exception",
        extra={"path": request.url.path},
    )
    return _error_response(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_server_error",
        message="An unexpected error occurred.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    # A pydantic ValidationError raised after request parsing is a server bug (a bad row
    # or a stale cached shape), not bad client input, so it falls through to the 500
    # handler. Client input errors arrive as RequestValidationError.
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
