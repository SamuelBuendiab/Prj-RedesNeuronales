from datetime import datetime

from pydantic import BaseModel, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=4, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserPublic(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True


class ProbabilityItem(BaseModel):
    label: str
    probability: float


class PredictResponse(BaseModel):
    predicted_class: str
    confidence: float
    accuracy: float
    processing_time_ms: float
    top_predictions: list[ProbabilityItem]
    probabilities: list[ProbabilityItem]
    ram_usage_mb: float
    cpu_usage_percent: float


class HistoryItem(BaseModel):
    id: int
    image_path: str
    predicted_class: str
    confidence: float
    accuracy: float
    processing_time_ms: float
    created_at: datetime

    class Config:
        from_attributes = True


class MetricsSummary(BaseModel):
    total_queries: int
    success_rate: float
    avg_inference_ms: float
    avg_cpu: float
    avg_ram_mb: float
    recent_latency: list[dict]
    recent_memory: list[dict]
    hourly_predictions: list[dict]
