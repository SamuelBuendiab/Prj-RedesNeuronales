import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta

import psutil
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend import predict_service
from backend.auth import authenticate_user, create_access_token, decode_token, hash_password
from backend.config import get_settings
from backend.database import SessionLocal, get_db, init_db
from backend.db_models import Prediction, ServerMetric, User
from backend.schemas import (
    HistoryItem,
    MetricsSummary,
    PredictResponse,
    ProbabilityItem,
    Token,
    UserCreate,
    UserLogin,
    UserPublic,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("carsia")

settings = get_settings()
security = HTTPBearer(auto_error=False)

STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sesión no válida o expirada.")
    username = decode_token(credentials.credentials)
    if username is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado.")
    return user


def seed_demo_user(db: Session) -> None:
    if db.query(User).filter(User.username == "admin").first():
        return
    user = User(username="admin", password_hash=hash_password("1234"))
    db.add(user)
    db.commit()
    logger.info("Usuario demo creado: admin / 1234")


@app.on_event("startup")
def on_startup() -> None:
    os.makedirs(settings.uploads_dir, exist_ok=True)
    if settings.database_url.startswith("sqlite"):
        raw = settings.database_url.replace("sqlite:///", "", 1)
        db_path = raw if os.path.isabs(raw) else os.path.abspath(raw)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    init_db()
    db = SessionLocal()
    try:
        seed_demo_user(db)
    finally:
        db.close()
    if predict_service.inference_assets_ready():
        predict_service.warm_model()
        logger.info("Modelo ML listo.")
    else:
        logger.warning(
            "Archivos de inferencia ausentes en %s; /api/predict devolverá 503.",
            settings.models_dir,
        )
    if settings.secret_key == "change-me-in-production-use-long-random-string":
        logger.warning("SECRET_KEY por defecto: configúrela en producción (Cloud Run).")


@app.get("/api/health")
def health() -> dict:
    assets = predict_service.inference_assets_ready()
    meta_ok = os.path.isfile(settings.metadata_path)
    return {
        "status": "ok" if assets else "degraded",
        "app": settings.app_name,
        "model_loaded": predict_service.is_model_loaded(),
        "inference_assets_ready": assets,
        "metadata_present": meta_ok,
    }


@app.post("/api/register", response_model=UserPublic)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe.")
    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Nuevo usuario registrado: %s", user.username)
    return user


@app.post("/api/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> dict:
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    token = create_access_token(user.username)
    logger.info("Login exitoso: %s", user.username)
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/predict", response_model=PredictResponse)
async def predict(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PredictResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo requerido.")

    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Formato no permitido. Use JPG, PNG o WEBP.",
        )

    raw = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(raw) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande. Máximo {settings.max_upload_mb} MB.",
        )
    if len(raw) < 32:
        raise HTTPException(status_code=400, detail="Imagen demasiado pequeña o vacía.")

    process = psutil.Process(os.getpid())
    cpu_before = psutil.cpu_percent(interval=None)
    ram_before = process.memory_info().rss / (1024 * 1024)
    t0 = time.perf_counter()

    try:
        result = predict_service.predict_from_bytes(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        logger.error("Modelo no disponible: %s", e)
        raise HTTPException(status_code=503, detail="Modelo ML no disponible.") from e
    except Exception as e:
        logger.exception("Error en inferencia")
        try:
            _record_metric(db, inference_time=0, request_time=0, success=0)
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=500, detail="Error al procesar la imagen.") from e

    t1 = time.perf_counter()
    processing_ms = (t1 - t0) * 1000.0
    cpu_after = psutil.cpu_percent(interval=None)
    ram_after = process.memory_info().rss / (1024 * 1024)
    cpu_usage = float(max(cpu_before, cpu_after, 0.0) or 0.0)
    ram_usage = float(max(ram_before, ram_after))

    safe_name = f"{user.id}_{uuid.uuid4().hex}{ext}"
    dest = os.path.join(settings.uploads_dir, safe_name)
    with open(dest, "wb") as out:
        out.write(raw)

    pred_row = Prediction(
        user_id=user.id,
        image_path=safe_name,
        predicted_class=result["predicted_class"],
        confidence=result["confidence"],
        accuracy=result["accuracy"],
        processing_time_ms=processing_ms,
        probabilities_json=json.dumps(result["probabilities"], ensure_ascii=False),
    )
    db.add(pred_row)
    _record_metric(
        db,
        cpu_usage=cpu_usage,
        ram_usage=ram_usage,
        inference_time=processing_ms,
        request_time=processing_ms,
        success=1,
    )
    db.commit()

    logger.info(
        "Predicción user=%s clase=%s conf=%.4f tiempo=%.1fms",
        user.username,
        result["predicted_class"],
        result["confidence"],
        processing_ms,
    )

    return PredictResponse(
        predicted_class=result["predicted_class"],
        confidence=result["confidence"],
        accuracy=result["accuracy"],
        processing_time_ms=round(processing_ms, 2),
        top_predictions=[ProbabilityItem(**p) for p in result["top_predictions"]],
        probabilities=[ProbabilityItem(**p) for p in result["probabilities"]],
        ram_usage_mb=round(ram_usage, 2),
        cpu_usage_percent=round(cpu_usage, 2),
    )


def _record_metric(
    db: Session,
    *,
    cpu_usage: float = 0.0,
    ram_usage: float = 0.0,
    inference_time: float = 0.0,
    request_time: float = 0.0,
    success: int = 1,
) -> None:
    row = ServerMetric(
        cpu_usage=cpu_usage,
        ram_usage=ram_usage,
        inference_time=inference_time,
        request_time=request_time,
        success=success,
    )
    db.add(row)


@app.get("/api/metrics", response_model=MetricsSummary)
def metrics(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MetricsSummary:  # noqa: ARG001
    _ = user
    total_pred = db.query(func.count(Prediction.id)).scalar() or 0
    success_count = db.query(ServerMetric).filter(ServerMetric.success == 1).count()
    fail_count = db.query(ServerMetric).filter(ServerMetric.success == 0).count()
    denom = success_count + fail_count
    success_rate = round((success_count / denom * 100) if denom else 100.0, 2)

    avg_inf = db.query(func.avg(ServerMetric.inference_time)).scalar()
    avg_cpu = db.query(func.avg(ServerMetric.cpu_usage)).scalar()
    avg_ram = db.query(func.avg(ServerMetric.ram_usage)).scalar()

    recent = (
        db.query(ServerMetric)
        .order_by(ServerMetric.created_at.desc())
        .limit(24)
        .all()
    )
    recent = list(reversed(recent))
    recent_latency = [
        {
            "t": r.created_at.isoformat() if r.created_at else "",
            "ms": round(float(r.inference_time), 2),
        }
        for r in recent
    ]
    recent_memory = [
        {
            "t": r.created_at.isoformat() if r.created_at else "",
            "mb": round(float(r.ram_usage), 2),
        }
        for r in recent
    ]

    since = datetime.utcnow() - timedelta(hours=24)
    hour_bucket = func.strftime("%Y-%m-%d %H:00", Prediction.created_at)
    hourly_raw = (
        db.query(hour_bucket, func.count(Prediction.id))
        .filter(Prediction.created_at >= since)
        .group_by(hour_bucket)
        .order_by(hour_bucket)
        .all()
    )
    hourly_predictions = [{"label": str(a[0]), "count": int(a[1])} for a in hourly_raw]

    return MetricsSummary(
        total_queries=int(total_pred),
        success_rate=success_rate,
        avg_inference_ms=round(float(avg_inf or 0), 2),
        avg_cpu=round(float(avg_cpu or 0), 2),
        avg_ram_mb=round(float(avg_ram or 0), 2),
        recent_latency=recent_latency,
        recent_memory=recent_memory,
        hourly_predictions=hourly_predictions,
    )


@app.get("/api/history", response_model=list[HistoryItem])
def history(
    q: str | None = Query(None, description="Buscar por clase o nombre de archivo"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Prediction]:
    query = db.query(Prediction).filter(Prediction.user_id == user.id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Prediction.predicted_class.ilike(like)) | (Prediction.image_path.ilike(like))
        )
    rows = query.order_by(Prediction.created_at.desc()).limit(200).all()
    return rows


@app.get("/api/uploads/{filename}")
def serve_upload(
    filename: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileResponse:
    if ".." in filename or filename.startswith(("/", "\\")):
        raise HTTPException(status_code=400, detail="Nombre inválido.")
    exists = (
        db.query(Prediction.id)
        .filter(Prediction.image_path == filename, Prediction.user_id == user.id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    path = os.path.join(settings.uploads_dir, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    return FileResponse(path)


if os.path.isdir(os.path.join(STATIC_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")


@app.get("/{full_path:path}")
async def spa(full_path: str) -> FileResponse:
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")
    index = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    raise HTTPException(status_code=503, detail="Frontend no disponible. Ejecute el build.")
