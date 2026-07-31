FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 8000

# entrypoint.sh waits for a network database (PostgreSQL, e.g. in docker
# compose) to become reachable before starting Uvicorn. It is a no-op for
# the default SQLite DATABASE_URL.
ENTRYPOINT ["./entrypoint.sh"]

