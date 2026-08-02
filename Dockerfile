# RExA — single-service production image (frontend + API)
# Free-tier friendly: no torch/DistilBERT; Core RExA sklearn or heuristic.

# ---- Stage 1: build React (Vite) ----
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json components.json ./
COPY public ./public
COPY src ./src
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ---- Stage 2: API + static UI ----
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_MODE=trained \
    USE_DISTILBERT_STARS=false \
    DATABASE_URL=sqlite:///./earas.db \
    PROJECT_NAME="RExA API" \
    API_PREFIX=/api \
    CORS_ORIGINS=* \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# Ship sklearn checkpoints for Core RExA (skip DistilBERT weights)
COPY ml/checkpoints/large ./ml/checkpoints/large
COPY ml/checkpoints/sentence_roles ./ml/checkpoints/sentence_roles
COPY ml/checkpoints/concept_coverage ./ml/checkpoints/concept_coverage
COPY ml/checkpoints/support_contradiction ./ml/checkpoints/support_contradiction
COPY ml/checkpoints/reasoning_depth ./ml/checkpoints/reasoning_depth
COPY ml/checkpoints/star_prediction ./ml/checkpoints/star_prediction
COPY --from=frontend /frontend/dist ./static

RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
