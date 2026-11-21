"""Vercel Python endpoint for the 3D rendering profile recommendation."""
from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path

import numpy as np

from ml.train_3d_quality_model import (
    FEATURES,
    FEATURE_RANGES,
    POLICY_VERSION,
    ensemble_uncertainty,
    feature_distribution_penalty,
    feature_novelty_penalty,
    validate_artifact_bundle,
)


MODEL_PATH = Path(__file__).resolve().parents[1] / "ml" / "artifacts" / "3d_quality_model.joblib"
MODEL = None


def validate_bundle(bundle):
    validate_artifact_bundle(bundle)
    return bundle


def get_model():
    global MODEL
    if MODEL is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"3D quality champion artifact is missing: {MODEL_PATH}")
        import joblib
        MODEL = joblib.load(MODEL_PATH)
    return validate_bundle(MODEL)


def profile(payload):
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object")
    if "webglAvailable" in payload and not isinstance(payload["webglAvailable"], bool):
        raise ValueError("webglAvailable must be a boolean")
    values = [
        float(payload.get("zoom", 19)),
        float(payload.get("roofVertices", 4)),
        float(payload.get("viewportWidth", 1280)),
        float(payload.get("viewportHeight", 800)),
        float(payload.get("devicePixelRatio", 1)),
        float(payload.get("networkDownlinkMbps", 10)),
        1 if payload.get("webglAvailable", True) else 0,
    ]
    if not all(np.isfinite(value) for value in values):
        raise ValueError("Rendering profile features must be finite numbers")
    for index, feature in enumerate(FEATURES):
        lower, upper = FEATURE_RANGES[feature]
        if values[index] < lower or values[index] > upper:
            raise ValueError(f"{feature} must be between {lower:g} and {upper:g}")
    bundle = get_model()
    feature_array = np.asarray([values])
    prediction = bundle["model"].predict(feature_array)[0]
    tilt, max_zoom, texture_score = prediction
    spread = ensemble_uncertainty(bundle["model"], feature_array)
    target_ranges = np.asarray([32.5, 6.0, 1.0])
    normalized_spread = spread / target_ranges
    calibration_scale = np.asarray(
        bundle.get("metrics", {}).get("uncertainty_calibration_scale", [1.0] * len(spread)),
        dtype=float,
    )
    if calibration_scale.shape != spread.shape or not np.isfinite(calibration_scale).all():
        calibration_scale = np.ones_like(spread)
    calibrators = bundle.get("uncertainty_calibrators")
    if isinstance(calibrators, list) and len(calibrators) == len(spread):
        expected_error = np.asarray([
            calibrator.predict([spread[index]])[0]
            for index, calibrator in enumerate(calibrators)
        ], dtype=float)
        calibration_method = "isotonic-out-of-fold"
    else:
        expected_error = spread * calibration_scale
        calibration_method = "scalar-out-of-fold"
    calibrated_uncertainty = expected_error / target_ranges
    calibrated_uncertainty_score = float(np.mean(calibrated_uncertainty))
    bounds_penalty = feature_distribution_penalty(
        bundle.get("feature_bounds", {
            feature: [values[index], values[index]]
            for index, feature in enumerate(FEATURES)
        }),
        feature_array,
    )
    neighbor_penalty = feature_novelty_penalty(bundle["novelty_detector"], feature_array)
    distribution_penalty = max(bounds_penalty, neighbor_penalty)
    fallback_quantile = np.asarray(bundle.get("metrics", {}).get("holdout_mae", [1.0, 0.25, 0.05]), dtype=float) * 2
    residual_quantile = np.asarray(
        bundle.get("metrics", {}).get("residual_quantile_90", fallback_quantile),
        dtype=float,
    )
    if residual_quantile.shape != spread.shape or not np.isfinite(residual_quantile).all():
        residual_quantile = fallback_quantile
    interval_half_width = residual_quantile * (1 + distribution_penalty)
    target_mins = np.asarray([35.0, 15.0, 0.0])
    target_maxs = np.asarray([67.5, 21.0, 1.0])
    interval_bounds = np.column_stack([
        np.maximum(prediction - interval_half_width, target_mins),
        np.minimum(prediction + interval_half_width, target_maxs),
    ])
    uncertainty = float(np.clip(max(calibrated_uncertainty_score, distribution_penalty), 0, 1))
    confidence = float(np.clip(1 - uncertainty, 0, 1))
    return {
        "tilt": round(float(np.clip(tilt, 35, 67.5)), 1),
        "maxZoom": round(float(np.clip(max_zoom, 15, 21)), 1),
        "textureQuality": "high" if texture_score >= 0.65 else "standard",
        "confidence": round(confidence, 3),
        "uncertainty": round(uncertainty, 4),
        "distributionPenalty": round(distribution_penalty, 4),
        "boundsPenalty": round(bounds_penalty, 4),
        "neighborPenalty": round(neighbor_penalty, 4),
        "uncertaintyByTarget": [round(float(value), 4) for value in normalized_spread],
        "calibratedUncertaintyByTarget": [round(float(value), 4) for value in calibrated_uncertainty],
        "expectedErrorByTarget": [round(float(value), 4) for value in expected_error],
        "uncertaintyCalibrationMethod": calibration_method,
        "intervalCoverage": 0.9,
        "intervalCalibrationMethod": bundle.get("metrics", {}).get(
            "interval_calibration_method", "empirical-residual-quantile"
        ),
        "empiricalIntervalCoverageByTarget": [
            round(float(value), 4)
            for value in bundle.get("metrics", {}).get("residual_coverage_90", [0.9, 0.9, 0.9])
        ],
        "intervalHalfWidthByTarget": [round(float(value), 4) for value in interval_half_width],
        "predictionIntervalByTarget": [
            [round(float(lower), 4), round(float(upper), 4)]
            for lower, upper in interval_bounds
        ],
        "model": bundle["version"],
        "trainingSource": bundle.get("source", "unknown"),
        "trainingRows": bundle.get("training_rows", 0),
        "metrics": bundle.get("metrics", {}),
        "featureImportance": bundle.get("feature_importance", {}),
        "permutationImportance": bundle.get("permutation_importance", {}),
        "features": FEATURES,
        "schemaVersion": bundle["schema_version"],
        "policyVersion": bundle.get("policy_version", POLICY_VERSION),
        "datasetFingerprint": bundle["dataset_fingerprint"],
        "sklearnVersion": bundle.get("sklearn_version"),
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            result = profile(payload)
            body = json.dumps(result).encode()
            self.send_response(200)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            body = json.dumps({"error": str(exc)}).encode()
            self.send_response(400)
        except Exception as exc:
            body = json.dumps({"error": "3D profile model unavailable", "detail": str(exc)}).encode()
            self.send_response(503)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.send_response(405)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"error":"Method not allowed. Use POST."}')
