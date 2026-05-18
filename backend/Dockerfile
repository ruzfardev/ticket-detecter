# syntax=docker/dockerfile:1.6
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better Docker layer caching)
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# App source
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

EXPOSE 8000

# Default: API server. Override `command:` in compose to run worker or alembic.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
