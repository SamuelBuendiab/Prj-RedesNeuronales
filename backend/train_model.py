"""
Script opcional: genera `models/model.pkl` (sklearn de juguete).
La inferencia en producción usa Keras + MobileNetV2 (`predict_service.py`).
Ejecutar desde la raíz: python -m backend.train_model
"""import os
import pickle
import sys

import numpy as np
from sklearn.ensemble import RandomForestClassifier

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(ROOT, "models")
OUT_PATH = os.path.join(MODEL_DIR, "model.pkl")

CLASS_NAMES = np.array(
    [
        "Gato doméstico",
        "Felino salvaje",
        "Perro",
        "Otro animal",
    ]
)
N_CLASSES = len(CLASS_NAMES)
N_FEATURES = 128 * 128 * 3
RNG = np.random.default_rng(42)


def main() -> None:
    os.makedirs(MODEL_DIR, exist_ok=True)
    X = RNG.random((800, N_FEATURES), dtype=np.float32)
    y_idx = RNG.integers(0, N_CLASSES, size=(800,))
    y = CLASS_NAMES[y_idx]
    clf = RandomForestClassifier(
        n_estimators=40,
        max_depth=12,
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X, y)
    with open(OUT_PATH, "wb") as f:
        pickle.dump(clf, f)
    print(f"Modelo guardado en {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
