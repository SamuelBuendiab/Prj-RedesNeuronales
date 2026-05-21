# CarsIA

Aplicación web full stack para **clasificación de marcas de automóviles** con **TensorFlow / Keras** (MobileNetV2 + red densa), **FastAPI**, **React + Vite**, **SQLite** y **TailwindCSS**. Un solo proceso sirve la API y el frontend compilado; lista para **Docker** y **Google Cloud Run**.

## Archivos del modelo (`models/`)

Coloca aquí los artefactos entrenados:

| Archivo | Rol |
|---------|-----|
| `neural_network.keras` | Red densa sobre embeddings |
| `label_encoder.pkl` | `LabelEncoder` (joblib) |
| `scaler.pkl` | `StandardScaler` (joblib) |
| `remap.pkl` | Diccionario con clave `remap_inverse` |
| `metadata.pkl` | Opcional: métricas (`val_accuracy`, etc.) para mostrar accuracy |

Pipeline en inferencia: imagen RGB 224×224 → `preprocess_input` MobileNetV2 → embeddings → scaler → red → probabilidades → `remap_inverse` → `inverse_transform` del encoder → **Top-5** y barras (hasta 20 clases ordenadas).

## Estructura

- `backend/` — FastAPI, SQLAlchemy, JWT, `predict_service.py` (Keras)
- `frontend/` — React (Vite), Axios, Recharts, Lucide
- `models/` — Artefactos anteriores (no se versionan pesos grandes salvo que tú lo decidas)
- `uploads/` — imágenes subidas
- `database/` — `app.db` (SQLite local)
- `static/` — salida de `npm run build`

## Usuario demo

- **Usuario:** `admin` / **Contraseña:** `1234`

## Requisitos locales

- **Python 3.11** (recomendado; alineado con la imagen Docker)
- Node.js 20+

## Desarrollo local

### 1. Dependencias Python

```powershell
cd ruta\al\proyecto
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend\requirements.txt
```

Asegúrate de tener los archivos del modelo en `models\` (ver tabla arriba). La primera carga puede descargar los pesos **ImageNet** de MobileNetV2 (~14 MB).

### 2. Frontend → `static`

```powershell
cd frontend
npm install
npm run build
cd ..
```

### 3. Arrancar API (sirve el SPA)

```powershell
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Abrir `http://127.0.0.1:8000`. API bajo `/api/...`.

### Frontend con hot-reload

```powershell
cd frontend
npm run dev
```

## Docker (un solo contenedor)

El `Dockerfile` copia `models/` a la imagen y precarga MobileNetV2 para acelerar el arranque.

```powershell
docker build -t carsia .
docker run --rm -p 8080:8080 -e PORT=8080 carsia
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto (Cloud Run) |
| `SECRET_KEY` | JWT (obligatorio en producción) |
| `DATABASE_URL` | SQLite por defecto |
| `UPLOADS_DIR` | Subidas |
| `MAX_UPLOAD_MB` | Límite de tamaño (default 8) |
| `NN_MODEL_PATH` | Ruta al `.keras` |
| `LABEL_ENCODER_PATH` | `label_encoder.pkl` |
| `SCALER_PATH` | `scaler.pkl` |
| `REMAP_PATH` | `remap.pkl` |
| `METADATA_PATH` | `metadata.pkl` (opcional) |
| `TF_CPP_MIN_LOG_LEVEL` | `2` reduce ruido de logs TF |

## Google Cloud Run

- Asigna **memoria suficiente** (p. ej. **2 GiB** o más) por TensorFlow.
- **Timeout de solicitud** ≥ 120 s y **timeout de arranque** ≥ 180 s (carga del modelo en `startup`).
- **Concurrencia por instancia: 1** (un solo proceso carga el modelo; evita duplicar RAM).
- `SECRET_KEY` fuerte en variables de entorno (no usar el valor por defecto).
- SQLite en disco efímero: los datos se pierden al reiniciar la revisión; aceptable para demo, no para producción persistente.

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado; `inference_assets_ready` indica si existen los archivos del modelo |
| POST | `/api/register` | Registro |
| POST | `/api/login` | JWT |
| POST | `/api/predict` | Multipart `file` (JPG/PNG/WEBP), `Authorization: Bearer …` |
| GET | `/api/metrics` | Métricas agregadas |
| GET | `/api/history` | Historial; query `q` opcional |

Documentación: `/docs`.

## Notas

- `backend/train_model.py` es un script **opcional** de demostración con sklearn; **no** forma parte del pipeline de producción (Keras).
- Sesión JWT: el frontend redirige a `/login` ante `401`.
