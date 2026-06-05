FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for some Python wheels (cryptography, bcrypt, jq, etc.).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Cloud Run injects $PORT (default 8080). Bind to 0.0.0.0 so the container is reachable.
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT}
