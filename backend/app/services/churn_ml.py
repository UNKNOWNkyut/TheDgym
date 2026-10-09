from pathlib import Path
from typing import Dict, List, Tuple
import joblib
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler

MODEL_DIR = Path(__file__).resolve().parent.parent / "ml"
MODEL_PATH = MODEL_DIR / "churn_model.pkl"
SCALER_PATH = MODEL_DIR / "scaler.pkl"

FEATURE_NAMES = [
    "visit_frequency_weekly",
    "days_since_last_checkin",
    "total_visits_30d",
    "total_class_bookings",
    "total_pt_sessions",
    "membership_tenure_days",
    "total_revenue_lifetime",
    "recent_activity_score",
]

_cached_model = None
_cached_scaler = None


def get_model_and_scaler() -> Tuple[XGBClassifier, StandardScaler]:
    global _cached_model, _cached_scaler
    if _cached_model is None or _cached_scaler is None:
        if not MODEL_PATH.exists() or not SCALER_PATH.exists():
            # If not yet trained, train baseline model
            train_baseline_model()
        _cached_model = joblib.load(MODEL_PATH)
        _cached_scaler = joblib.load(SCALER_PATH)
    return _cached_model, _cached_scaler


def train_baseline_model(save: bool = True) -> Dict[str, float]:
    """
    Trains a robust XGBoost classification model on synthetic gym attendance data
    tailored to The DGym's behavioral metrics.
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    np.random.seed(42)
    n_samples = 400

    # 1. Generate Retained / Consistent Lifters (60% of data)
    n_retained = int(n_samples * 0.65)
    retained_freq = np.random.uniform(2.5, 5.5, n_retained)
    retained_recency = np.random.randint(1, 6, n_retained)
    retained_visits_30d = np.clip(np.random.normal(14, 3, n_retained).astype(int), 8, 25)
    retained_classes = np.random.poisson(3.0, n_retained)
    retained_pt = np.random.poisson(1.5, n_retained)
    retained_tenure = np.random.randint(60, 400, n_retained)
    retained_rev = np.random.uniform(2000, 15000, n_retained)
    retained_momentum = np.random.uniform(0.65, 1.0, n_retained)
    labels_retained = np.zeros(n_retained, dtype=int)

    # 2. Generate At-Risk / Churning Lifters (35% of data)
    n_churn = n_samples - n_retained
    churn_freq = np.random.uniform(0.1, 1.5, n_churn)
    churn_recency = np.random.randint(12, 45, n_churn)
    churn_visits_30d = np.clip(np.random.normal(2, 1.5, n_churn).astype(int), 0, 5)
    churn_classes = np.random.poisson(0.4, n_churn)
    churn_pt = np.random.poisson(0.2, n_churn)
    churn_tenure = np.random.randint(15, 200, n_churn)
    churn_rev = np.random.uniform(500, 4000, n_churn)
    churn_momentum = np.random.uniform(0.05, 0.35, n_churn)
    labels_churn = np.ones(n_churn, dtype=int)

    # Combine datasets
    data = {
        "visit_frequency_weekly": np.concatenate([retained_freq, churn_freq]),
        "days_since_last_checkin": np.concatenate([retained_recency, churn_recency]),
        "total_visits_30d": np.concatenate([retained_visits_30d, churn_visits_30d]),
        "total_class_bookings": np.concatenate([retained_classes, churn_classes]),
        "total_pt_sessions": np.concatenate([retained_pt, churn_pt]),
        "membership_tenure_days": np.concatenate([retained_tenure, churn_tenure]),
        "total_revenue_lifetime": np.concatenate([retained_rev, churn_rev]),
        "recent_activity_score": np.concatenate([retained_momentum, churn_momentum]),
    }
    df = pd.DataFrame(data)
    y = np.concatenate([labels_retained, labels_churn])

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[FEATURE_NAMES])

    # Train XGBoost
    model = XGBClassifier(
        max_depth=3,
        learning_rate=0.08,
        n_estimators=100,
        subsample=0.85,
        colsample_bytree=0.85,
        eval_metric="logloss",
        random_state=42,
    )
    model.fit(X_scaled, y)

    # Evaluate accuracy
    accuracy = float(np.mean(model.predict(X_scaled) == y))

    if save:
        joblib.dump(model, MODEL_PATH)
        joblib.dump(scaler, SCALER_PATH)
        global _cached_model, _cached_scaler
        _cached_model = model
        _cached_scaler = scaler

    return {
        "accuracy": accuracy,
        "n_samples": n_samples,
        "n_features": len(FEATURE_NAMES),
    }


def predict_churn(features: Dict[str, float]) -> Dict:
    """
    Inference helper for a single member's feature vector.
    Calculates probability, assigns Risk Tier, and extracts top 3 contributing factors.
    """
    model, scaler = get_model_and_scaler()

    # Create DataFrame with exact column names
    vector = pd.DataFrame([[float(features.get(col, 0.0)) for col in FEATURE_NAMES]], columns=FEATURE_NAMES)
    scaled_vector = scaler.transform(vector)

    # Predict probability of churn (class 1)
    prob = float(model.predict_proba(scaled_vector)[0][1])
    prob = max(0.01, min(0.99, prob))

    # Risk Tier Segmentation (per docs/ARCHITECTURE.md)
    if prob > 0.70:
        risk_tier = "HIGH"
    elif prob > 0.40:
        risk_tier = "MEDIUM"
    else:
        risk_tier = "LOW"

    # Identify top contributing risk factors based on feature thresholds
    factors: List[str] = []
    days_rec = features.get("days_since_last_checkin", 0)
    freq = features.get("visit_frequency_weekly", 0.0)
    visits_30 = features.get("total_visits_30d", 0)
    momentum = features.get("recent_activity_score", 1.0)
    classes = features.get("total_class_bookings", 0)
    pt = features.get("total_pt_sessions", 0)
    tenure = features.get("membership_tenure_days", 0)

    if days_rec >= 14:
        factors.append(f"No gym check-in recorded in the past {int(days_rec)} days")
    elif days_rec >= 7:
        factors.append(f"Inactivity: {int(days_rec)} days since last entry")

    if freq < 1.0:
        factors.append(f"Critically low weekly visit velocity ({freq:.1f}x / week)")
    elif freq < 2.0:
        factors.append(f"Infrequent attendance ({freq:.1f}x / week)")

    if momentum < 0.35:
        factors.append("Steep decline in recent activity momentum")

    if visits_30 <= 2:
        factors.append(f"Only {int(visits_30)} visit(s) logged across last 30 days")

    if classes == 0 and pt == 0:
        factors.append("Zero participation in group classes or 1-on-1 coaching")

    if tenure <= 30:
        factors.append("New member in critical 30-day retention window")

    # Fallback if member is active
    if not factors:
        if risk_tier == "LOW":
            factors.append("Consistent weekly check-in frequency")
            factors.append("High recent activity momentum")
            factors.append("Active community & facility engagement")
        else:
            factors.append("Mild downward variance in weekly gym visits")

    # Keep top 3
    top_3_factors = factors[:3]

    return {
        "churn_probability": round(prob, 4),
        "risk_tier": risk_tier,
        "top_risk_factors": top_3_factors,
        "model_version": "xgboost_v1.0",
    }
