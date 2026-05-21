# syntax=docker/dockerfile:1
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

RUN python -c "\
import tensorflow as tf; \
tf.keras.applications.MobileNetV2(\
    weights='imagenet', include_top=False, pooling='avg', input_shape=(224,224,3)\
); \
print('MobileNetV2 weights cached')"

COPY backend /app/backend
RUN mkdir -p /app/models /app/uploads /app/database /app/static

COPY models /app/models

COPY --from=frontend-build /app/static /app/static

ENV PYTHONPATH=/app
ENV PORT=8080
ENV DATABASE_URL=sqlite:////app/database/app.db
ENV MODELS_DIR=/app/models
ENV NN_MODEL_PATH=/app/models/neural_network.keras
ENV LABEL_ENCODER_PATH=/app/models/label_encoder.pkl
ENV SCALER_PATH=/app/models/scaler.pkl
ENV REMAP_PATH=/app/models/remap.pkl
ENV METADATA_PATH=/app/models/metadata.pkl
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TF_ENABLE_ONEDNN_OPTS=0
ENV OMP_NUM_THREADS=1
ENV TF_NUM_INTRAOP_THREADS=1
ENV TF_NUM_INTEROP_THREADS=1
ENV UPLOADS_DIR=/app/uploads

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD-SHELL curl -sf "http://127.0.0.1:$${PORT:-8080}/api/health" || exit 1

CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
