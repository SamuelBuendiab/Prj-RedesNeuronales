import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB = (_ROOT / "database" / "app.db").as_posix()
_MODELS = _ROOT / "models"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        protected_namespaces=(),
    )

    app_name: str = "CarsIA"
    secret_key: str = os.getenv("SECRET_KEY", "change-me-in-production-use-long-random-string")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB}")
    uploads_dir: str = os.getenv("UPLOADS_DIR", str(_ROOT / "uploads"))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "8"))

    models_dir: str = os.getenv("MODELS_DIR", str(_MODELS))
    nn_model_path: str = os.getenv("NN_MODEL_PATH", str(_MODELS / "neural_network.keras"))
    label_encoder_path: str = os.getenv("LABEL_ENCODER_PATH", str(_MODELS / "label_encoder.pkl"))
    scaler_path: str = os.getenv("SCALER_PATH", str(_MODELS / "scaler.pkl"))
    remap_path: str = os.getenv("REMAP_PATH", str(_MODELS / "remap.pkl"))
    metadata_path: str = os.getenv("METADATA_PATH", str(_MODELS / "metadata.pkl"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
