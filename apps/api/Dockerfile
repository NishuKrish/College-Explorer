FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/apps/api

WORKDIR /app

# AWS Lambda Web Adapter runs this same uvicorn server on Lambda. Outside Lambda it is an
# inert file, so Docker Compose and the Lambda deployment share one image.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_PORT=8000 \
    AWS_LWA_READINESS_CHECK_PATH=/health

COPY apps/api/requirements.txt apps/api/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r apps/api/requirements.txt

COPY LICENSE NOTICE /app/licenses/
COPY LICENSES /app/licenses/original/
COPY apps/api apps/api
COPY data/seed data/seed

# Lambda runs the function as its own unprivileged user; this covers Compose and self-hosting.
RUN useradd --system --no-create-home --uid 10001 app
USER app

WORKDIR /app/apps/api

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
