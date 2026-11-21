"""Train the 3D-view rendering profile model.

The benchmark labels are conservative defaults. ``--online`` augments them with
public OpenStreetMap building geometry and height tags from Overpass.
"""
import argparse
import hashlib
import json
import math
import os
import re
import shutil
import tempfile
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.exceptions import NotFittedError
from sklearn.ensemble import BaggingRegressor, ExtraTreesRegressor, HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.base import clone
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.multioutput import MultiOutputRegressor
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, KFold
from sklearn.neighbors import NearestNeighbors
from sklearn.inspection import permutation_importance
from sklearn.preprocessing import StandardScaler
from sklearn.isotonic import IsotonicRegression
from sklearn.utils.validation import check_is_fitted

FEATURES = [
    "zoom",
    "roof_vertices",
    "viewport_width",
    "viewport_height",
    "device_pixel_ratio",
    "network_downlink_mbps",
    "webgl_available",
]
TARGETS = ["tilt", "max_zoom", "texture_quality_score"]
FEATURE_RANGES = {
    "zoom": (3.0, 21.0),
    "roof_vertices": (3.0, 100.0),
    "viewport_width": (1.0, 16384.0),
    "viewport_height": (1.0, 16384.0),
    "device_pixel_ratio": (0.1, 8.0),
    "network_downlink_mbps": (0.0, 1000.0),
    "webgl_available": (0.0, 1.0),
}
SCHEMA_VERSION = 3
POLICY_VERSION = 2
ONLINE_CENTERS = [(19.076, 72.877), (28.6139, 77.209), (12.9716, 77.5946)]
TARGET_SPANS = np.asarray([32.5, 6.0, 1.0])
MIN_PROMOTION_ROWS = 64
MIN_PROMOTION_COMPARISON_CONTEXTS = 32
MIN_PROMOTION_COMPARISON_RATE = 0.5
MIN_ACCEPTABLE_TEXTURE_SCORE = 0.65
ALGORITHMS = ("random-forest", "extra-trees", "hist-gradient-boosting")


def ensemble_uncertainty(model, features):
    """Return per-target standard deviation across ensemble members."""
    spreads = []
    for target_model in model.estimators_:
        tree_predictions = np.asarray([
            tree.predict(features) for tree in target_model.estimators_
        ])
        spreads.append(float(tree_predictions.std(axis=0).mean()))
    return np.asarray(spreads)


def ensemble_uncertainty_by_sample(model, features):
    """Return per-sample ensemble spread for each target."""
    spreads = []
    for target_model in model.estimators_:
        tree_predictions = np.asarray([
            tree.predict(features) for tree in target_model.estimators_
        ])
        spreads.append(tree_predictions.std(axis=0))
    return np.column_stack(spreads)


def cross_validation_uncertainty_calibrators(candidate, features, targets, splits=3, groups=None):
    """Fit monotonic per-target spread-to-error calibrators from held-out folds."""
    absolute_errors = []
    spreads = []
    for train_indices, validation_indices in validation_splits(features, groups, splits):
        fold_model = _clone_candidate_for_fit(candidate, len(train_indices))
        fold_model.fit(features[train_indices], targets[train_indices])
        validation_features = features[validation_indices]
        predictions = fold_model.predict(validation_features)
        absolute_errors.append(np.abs(targets[validation_indices] - predictions))
        spreads.append(ensemble_uncertainty_by_sample(fold_model, validation_features))
    errors = np.concatenate(absolute_errors, axis=0)
    spread_values = np.concatenate(spreads, axis=0)
    return [
        IsotonicRegression(y_min=0, out_of_bounds="clip").fit(
            spread_values[:, index], errors[:, index]
        )
        for index in range(len(TARGETS))
    ]


def normalized_target_mae(errors):
    """Return mean MAE after scaling each target by its deployable span."""
    values = np.asarray(errors, dtype=float)
    if values.shape != (len(TARGETS),) or not np.isfinite(values).all():
        raise ValueError("Target MAE must contain one finite value per target")
    return float(np.mean(values / TARGET_SPANS))


def conformal_quantile_level(sample_count, coverage=0.9):
    """Return the finite-sample conformal rank expressed as a quantile level."""
    if not isinstance(sample_count, (int, np.integer)) or sample_count < 1:
        raise ValueError("Conformal calibration requires at least one residual")
    if not 0 < coverage < 1:
        raise ValueError("Conformal coverage must be between 0 and 1")
    return min(1.0, math.ceil((sample_count + 1) * coverage) / sample_count)


def normalized_negative_mae(estimator, features, targets):
    """Score multi-target predictions using target-scale-normalized MAE."""
    predictions = estimator.predict(features)
    errors = mean_absolute_error(targets, predictions, multioutput="raw_values")
    return -normalized_target_mae(errors)


def held_out_permutation_importance(model, features, targets):
    """Return normalized held-out permutation drops for the fitted candidate."""
    result = permutation_importance(
        model,
        features,
        targets,
        scoring=normalized_negative_mae,
        n_repeats=5,
        random_state=7,
        n_jobs=-1,
    )
    importances = np.clip(np.asarray(result.importances_mean, dtype=float), 0, None)
    total = float(importances.sum())
    if total <= 1e-12:
        importances = np.full(len(FEATURES), 1 / len(FEATURES))
    else:
        importances /= total
    return {
        feature: round(float(importances[index]), 6)
        for index, feature in enumerate(FEATURES)
    }


def feature_distribution_penalty(feature_bounds, features):
    """Return a normalized penalty for values outside the training bounds."""
    values = np.asarray(features, dtype=float)[0]
    penalties = []
    for index, feature in enumerate(FEATURES):
        lower, upper = feature_bounds[feature]
        span = max(float(upper) - float(lower), 1.0)
        distance = max(float(lower) - values[index], values[index] - float(upper), 0.0)
        penalties.append(distance / span)
    return float(np.clip(np.mean(penalties), 0, 1))


def fit_feature_novelty_detector(features):
    """Fit a scaled nearest-neighbor detector and calibrate its distance limit."""
    values = np.asarray(features, dtype=float)
    scaler = StandardScaler().fit(values)
    scaled = scaler.transform(values)
    neighbor_count = min(6, len(values))
    neighbors = NearestNeighbors(n_neighbors=neighbor_count).fit(scaled)
    distances, _ = neighbors.kneighbors(scaled)
    calibration = distances[:, 1:] if neighbor_count > 1 else distances
    threshold = max(float(np.percentile(calibration.mean(axis=1), 95)), 1e-6)
    return {
        "scaler": scaler,
        "neighbors": neighbors,
        "threshold": threshold,
        "reference_rows": int(len(values)),
    }


def feature_novelty_penalty(detector, features):
    """Return a normalized penalty for unfamiliar feature combinations."""
    scaled = detector["scaler"].transform(np.asarray(features, dtype=float))
    distances, _ = detector["neighbors"].kneighbors(scaled)
    mean_distance = float(distances.mean(axis=1)[0])
    ratio = mean_distance / max(float(detector["threshold"]), 1e-6)
    return float(np.clip(ratio - 1, 0, 1))


def validation_splits(features, groups=None, splits=3):
    """Yield deterministic validation folds, keeping related buildings together."""
    if groups is None:
        splitter = KFold(n_splits=splits, shuffle=True, random_state=7)
        yield from splitter.split(features)
        return
    splitter = GroupKFold(n_splits=splits)
    yield from splitter.split(features, groups=groups)


def _clone_candidate_for_fit(candidate, sample_count):
    """Clone a candidate and keep full-size bagging explicit for small folds."""
    fitted_candidate = clone(candidate)
    if (
        isinstance(fitted_candidate, MultiOutputRegressor)
        and isinstance(fitted_candidate.estimator, BaggingRegressor)
    ):
        fitted_candidate.set_params(estimator__max_samples=int(sample_count))
    return fitted_candidate


def cross_validation_mae_folds(candidate, features, targets, splits=3, groups=None):
    """Return per-target MAE for each deterministic validation fold."""
    fold_scores = []
    for train_indices, validation_indices in validation_splits(features, groups, splits):
        fold_model = _clone_candidate_for_fit(candidate, len(train_indices))
        fold_model.fit(features[train_indices], targets[train_indices])
        fold_scores.append(mean_absolute_error(
            targets[validation_indices],
            fold_model.predict(features[validation_indices]),
            multioutput="raw_values",
        ))
    return np.asarray(fold_scores)


def cross_validation_mae(candidate, features, targets, splits=3, groups=None):
    """Return mean per-target MAE across deterministic shuffled folds."""
    return cross_validation_mae_folds(candidate, features, targets, splits, groups).mean(axis=0)


def cross_validation_diagnostics(candidate, features, targets, splits=3, groups=None):
    """Fit each fold once and return shared OOF errors and ensemble spreads."""
    absolute_errors = []
    spreads = []
    for train_indices, validation_indices in validation_splits(features, groups, splits):
        fold_model = _clone_candidate_for_fit(candidate, len(train_indices))
        fold_model.fit(features[train_indices], targets[train_indices])
        validation_features = features[validation_indices]
        predictions = fold_model.predict(validation_features)
        absolute_errors.append(np.abs(targets[validation_indices] - predictions))
        spreads.append(ensemble_uncertainty_by_sample(fold_model, validation_features))
    errors = np.concatenate(absolute_errors, axis=0)
    spread_values = np.concatenate(spreads, axis=0)
    return {
        "absolute_errors": errors,
        "residuals": errors,
        "ensemble_spreads": spread_values,
    }


def cross_validation_uncertainty_calibration(candidate, features, targets, splits=3, groups=None):
    """Estimate per-target error per unit of tree-ensemble spread on held-out folds."""
    absolute_errors = []
    spreads = []
    for train_indices, validation_indices in validation_splits(features, groups, splits):
        fold_model = _clone_candidate_for_fit(candidate, len(train_indices))
        fold_model.fit(features[train_indices], targets[train_indices])
        validation_features = features[validation_indices]
        validation_targets = targets[validation_indices]
        predictions = fold_model.predict(validation_features)
        absolute_errors.append(np.abs(validation_targets - predictions).mean(axis=0))
        spreads.append(ensemble_uncertainty(fold_model, validation_features))
    mean_error = np.asarray(absolute_errors).mean(axis=0)
    mean_spread = np.asarray(spreads).mean(axis=0)
    return mean_error / np.maximum(mean_spread, 1e-6)


def cross_validation_residual_quantile(candidate, features, targets, splits=3, groups=None, quantile=0.9):
    """Return per-target held-out absolute-residual quantiles for interval calibration."""
    residuals = []
    for train_indices, validation_indices in validation_splits(features, groups, splits):
        fold_model = _clone_candidate_for_fit(candidate, len(train_indices))
        fold_model.fit(features[train_indices], targets[train_indices])
        residuals.append(np.abs(
            targets[validation_indices] - fold_model.predict(features[validation_indices])
        ))
    residuals = np.concatenate(residuals, axis=0)
    level = conformal_quantile_level(len(residuals), quantile)
    return np.quantile(residuals, level, axis=0, method="higher")


def cross_validation_residual_calibration(candidate, features, targets, splits=3, groups=None, quantile=0.9):
    """Fit folds once and return residual quantiles plus their empirical coverage."""
    residuals = []
    for train_indices, validation_indices in validation_splits(features, groups, splits):
        fold_model = _clone_candidate_for_fit(candidate, len(train_indices))
        fold_model.fit(features[train_indices], targets[train_indices])
        residuals.append(np.abs(
            targets[validation_indices] - fold_model.predict(features[validation_indices])
        ))
    residuals = np.concatenate(residuals, axis=0)
    level = conformal_quantile_level(len(residuals), quantile)
    quantiles = np.quantile(residuals, level, axis=0, method="higher")
    coverage = (residuals <= quantiles).mean(axis=0)
    return quantiles, coverage


def cross_validation_residual_coverage(candidate, features, targets, quantiles, splits=3, groups=None):
    """Measure held-out coverage achieved by fixed per-target residual quantiles."""
    residuals = []
    for train_indices, validation_indices in validation_splits(features, groups, splits):
        fold_model = _clone_candidate_for_fit(candidate, len(train_indices))
        fold_model.fit(features[train_indices], targets[train_indices])
        residuals.append(np.abs(
            targets[validation_indices] - fold_model.predict(features[validation_indices])
        ))
    residuals = np.concatenate(residuals, axis=0)
    return (residuals <= np.asarray(quantiles, dtype=float)).mean(axis=0)


def dataset_fingerprint(features, targets):
    """Hash the exact ordered numeric training arrays for artifact provenance."""
    digest = hashlib.sha256()
    digest.update(np.asarray(features, dtype=np.float64).tobytes())
    digest.update(np.asarray(targets, dtype=np.float64).tobytes())
    return digest.hexdigest()


def validate_feature_values(features):
    """Reject impossible runtime feature values before model fitting/inference."""
    values = np.asarray(features, dtype=float)
    for index, feature in enumerate(FEATURES):
        lower, upper = FEATURE_RANGES[feature]
        if (values[:, index] < lower).any() or (values[:, index] > upper).any():
            raise ValueError(
                f"Telemetry feature '{feature}' must be between {lower:g} and {upper:g}"
            )


def select_best_telemetry_trials(rows):
    """Choose the most detailed action that retains acceptable measured performance."""
    grouped = {}
    for row in rows:
        key = tuple(float(row[feature]) for feature in FEATURES)
        grouped.setdefault(key, []).append(row)
    selected = []
    for context in sorted(grouped):
        trials = grouped[context]
        acceptable = [
            row for row in trials
            if float(row["texture_quality_score"]) >= MIN_ACCEPTABLE_TEXTURE_SCORE
        ]
        if acceptable:
            selected.append(max(
                acceptable,
                key=lambda row: (
                    (
                        (float(row["tilt"]) - 35.0) / 32.5
                        + (float(row["max_zoom"]) - 15.0) / 6.0
                    ) / 2.0,
                    float(row["texture_quality_score"]),
                    float(row["tilt"]),
                    float(row["max_zoom"]),
                ),
            ))
        else:
            selected.append(max(
                trials,
                key=lambda row: (
                    float(row["texture_quality_score"]),
                    float(row["tilt"]),
                    float(row["max_zoom"]),
                ),
            ))
    return selected


def validate_artifact_bundle(bundle):
    """Validate persisted model metadata and return a deployment summary."""
    if not isinstance(bundle, dict):
        raise ValueError("Artifact must be a mapping")
    if bundle.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("Artifact schema version is incompatible")
    if bundle.get("policy_version") != POLICY_VERSION:
        raise ValueError("Artifact policy version is incompatible")
    artifact_sklearn_version = bundle.get("sklearn_version")
    version_match = (
        re.fullmatch(r"(\d+)\.(\d+)(?:\.\d+)?(?:[-+].*)?", artifact_sklearn_version)
        if isinstance(artifact_sklearn_version, str)
        else None
    )
    runtime_version_match = re.match(r"(\d+)\.(\d+)", sklearn.__version__)
    if (
        version_match is None
        or runtime_version_match is None
        or version_match.groups() != runtime_version_match.groups()
    ):
        raise ValueError("Artifact sklearn version is incompatible")
    if bundle.get("features") != FEATURES or bundle.get("targets") != TARGETS:
        raise ValueError("Artifact feature or target order is incompatible")
    algorithm = bundle.get("algorithm")
    if (
        algorithm not in ALGORITHMS
        or bundle.get("version") != f"{algorithm}-v{POLICY_VERSION}"
    ):
        raise ValueError("Artifact model identity is inconsistent")
    if bundle.get("source") not in {"benchmark", "openstreetmap-overpass", "telemetry"}:
        raise ValueError("Artifact training source is incompatible")
    training_rows = bundle.get("training_rows")
    if not isinstance(training_rows, (int, np.integer)) or training_rows < 1:
        raise ValueError("Artifact training row count is malformed")
    fingerprint = bundle.get("dataset_fingerprint")
    if not isinstance(fingerprint, str) or re.fullmatch(r"[0-9a-f]{64}", fingerprint) is None:
        raise ValueError("Artifact dataset fingerprint is missing or malformed")
    model = bundle.get("model")
    if not hasattr(model, "predict"):
        raise ValueError("Artifact model is not predictive")
    try:
        check_is_fitted(model)
    except (NotFittedError, TypeError) as error:
        raise ValueError("Artifact model is not fitted") from error
    if getattr(model, "n_features_in_", None) != len(FEATURES):
        raise ValueError("Artifact model feature count is incompatible")
    target_estimators = getattr(model, "estimators_", None)
    if isinstance(target_estimators, list) and len(target_estimators) == len(TARGETS):
        member_sets = [getattr(target_estimator, "estimators_", None) for target_estimator in target_estimators]
        if all(isinstance(member_estimators, list) and member_estimators for member_estimators in member_sets):
            for target_estimator, member_estimators in zip(target_estimators, member_sets):
                if getattr(target_estimator, "n_features_in_", None) != len(FEATURES):
                    raise ValueError("Artifact model ensemble member feature count is incompatible")
                if any(
                    getattr(member, "n_features_in_", None) != len(FEATURES)
                    for member in member_estimators
                ):
                    raise ValueError("Artifact model ensemble member feature count is incompatible")
    probe = np.asarray([[19.0, 8.0, 1440.0, 900.0, 2.0, 25.0, 1.0]], dtype=float)
    try:
        prediction = np.asarray(model.predict(probe))
    except (TypeError, ValueError, AttributeError) as error:
        raise ValueError("Artifact model prediction probe failed") from error
    if prediction.shape != (1, len(TARGETS)):
        raise ValueError("Artifact model prediction target count is incompatible")
    if not np.all(np.isfinite(prediction)):
        raise ValueError("Artifact model prediction is non-finite")
    if not isinstance(target_estimators, list) or len(target_estimators) != len(TARGETS):
        raise ValueError("Artifact model ensemble structure is incompatible")
    for target_estimator in target_estimators:
        member_estimators = getattr(target_estimator, "estimators_", None)
        if not isinstance(member_estimators, list) or not member_estimators:
            raise ValueError("Artifact model ensemble structure is incompatible")
        if not all(hasattr(member, "predict") for member in member_estimators):
            raise ValueError("Artifact model ensemble structure is incompatible")
        try:
            check_is_fitted(target_estimator)
            for member in member_estimators:
                check_is_fitted(member)
        except (NotFittedError, TypeError, AttributeError) as error:
            raise ValueError("Artifact model ensemble member is not fitted") from error
    detector = bundle.get("novelty_detector")
    if (
        not isinstance(detector, dict)
        or not hasattr(detector.get("scaler"), "transform")
        or not hasattr(detector.get("neighbors"), "kneighbors")
    ):
        raise ValueError("Artifact novelty detector is missing")
    scaler = detector["scaler"]
    neighbors = detector["neighbors"]
    try:
        check_is_fitted(scaler)
        check_is_fitted(neighbors)
    except (NotFittedError, TypeError, AttributeError) as error:
        raise ValueError("Artifact novelty detector is not fitted") from error
    if (
        getattr(scaler, "n_features_in_", None) != len(FEATURES)
        or getattr(neighbors, "n_features_in_", None) != len(FEATURES)
    ):
        raise ValueError("Artifact novelty detector feature count is incompatible")
    try:
        scaled_probe = np.asarray(scaler.transform(probe), dtype=float)
        neighbor_distances = np.asarray(neighbors.kneighbors(scaled_probe)[0], dtype=float)
    except (TypeError, ValueError, AttributeError) as error:
        raise ValueError("Artifact novelty detector probe failed") from error
    if scaled_probe.shape != probe.shape or not np.isfinite(scaled_probe).all():
        raise ValueError("Artifact novelty detector scaling is malformed")
    if neighbor_distances.shape[0] != 1 or not np.isfinite(neighbor_distances).all():
        raise ValueError("Artifact novelty detector distances are malformed")
    threshold = detector.get("threshold")
    reference_rows = detector.get("reference_rows")
    if not isinstance(threshold, (float, int)) or not np.isfinite(threshold) or threshold <= 0:
        raise ValueError("Artifact novelty detector threshold is malformed")
    if (
        not isinstance(reference_rows, (int, np.integer))
        or reference_rows < 1
        or reference_rows != training_rows
        or np.asarray(getattr(scaler, "n_samples_seen_", None)).shape != ()
        or float(scaler.n_samples_seen_) != training_rows
        or getattr(neighbors, "n_samples_fit_", None) != training_rows
    ):
        raise ValueError("Artifact training row provenance is inconsistent")
    calibrators = bundle.get("uncertainty_calibrators")
    if calibrators is not None and (
        not isinstance(calibrators, list)
        or len(calibrators) != len(TARGETS)
        or not all(hasattr(calibrator, "predict") for calibrator in calibrators)
    ):
        raise ValueError("Artifact uncertainty calibrators are malformed")
    if calibrators is not None:
        for index, calibrator in enumerate(calibrators):
            try:
                check_is_fitted(calibrator)
            except (NotFittedError, TypeError, AttributeError) as error:
                raise ValueError(
                    f"Artifact uncertainty calibrator {index + 1} is not fitted"
                ) from error
            calibrated_error = np.asarray(calibrator.predict([0.0]), dtype=float)
            if (
                calibrated_error.shape != (1,)
                or not np.isfinite(calibrated_error).all()
                or (calibrated_error < 0).any()
            ):
                raise ValueError(
                    f"Artifact uncertainty calibrator {index + 1} prediction is malformed"
                )
    metrics = bundle.get("metrics")
    if not isinstance(metrics, dict):
        raise ValueError("Artifact metrics are missing")
    partition_keys = ("selection_rows", "calibration_rows", "holdout_rows")
    partition_values = [metrics.get(key) for key in partition_keys]
    if any(value is not None for value in partition_values):
        if (
            not all(isinstance(value, (int, np.integer)) and value > 0 for value in partition_values)
            or partition_values[0] != partition_values[1]
            or partition_values[0] + partition_values[2] != bundle.get("training_rows")
        ):
            raise ValueError("Artifact evaluation partition sizes are malformed")
    if bundle.get("source") == "telemetry" and (
        metrics.get("telemetry_selection_policy") != "highest-detail-above-performance-floor"
        or not isinstance(metrics.get("minimum_acceptable_texture_score"), (float, int))
        or not np.isclose(
            metrics["minimum_acceptable_texture_score"],
            MIN_ACCEPTABLE_TEXTURE_SCORE,
        )
    ):
        raise ValueError("Artifact telemetry selection policy is incompatible")
    metric_ranges = {
        "holdout_mae": (0.0, None),
        "baseline_holdout_mae": (0.0, None),
        "uncertainty_scale": (0.0, None),
        "uncertainty_calibration_scale": (0.0, None),
        "residual_quantile_90": (0.0, None),
        "residual_coverage_90": (0.0, 1.0),
    }
    for metric, (minimum, maximum) in metric_ranges.items():
        values = np.asarray(metrics.get(metric), dtype=float)
        if values.shape != (len(TARGETS),) or not np.isfinite(values).all():
            raise ValueError(f"Artifact metric '{metric}' must contain {len(TARGETS)} finite values")
        if (values < minimum).any() or (maximum is not None and (values > maximum).any()):
            upper_message = f" and {maximum:g}" if maximum is not None else " or greater"
            raise ValueError(f"Artifact metric '{metric}' values must be between {minimum:g}{upper_message}")
    holdout_r2 = np.asarray(metrics.get("holdout_r2"), dtype=float)
    if holdout_r2.shape != (len(TARGETS),) or not np.isfinite(holdout_r2).all() or (holdout_r2 > 1).any():
        raise ValueError("Artifact metric 'holdout_r2' must contain finite values no greater than 1")
    baseline_skill = metrics.get("normalized_skill_vs_baseline")
    if not isinstance(baseline_skill, (float, int)) or not np.isfinite(baseline_skill) or baseline_skill > 1:
        raise ValueError("Artifact normalized baseline skill is malformed")
    interval_method = metrics.get("interval_calibration_method")
    interval_level = metrics.get("residual_quantile_level_90")
    if interval_method is not None and interval_method != "cross-conformal-finite-sample":
        raise ValueError("Artifact interval calibration method is incompatible")
    if interval_level is not None and (
        not isinstance(interval_level, (float, int))
        or not np.isfinite(interval_level)
        or interval_level < 0.9
        or interval_level > 1
    ):
        raise ValueError("Artifact residual quantile level is malformed")
    normalized_cv = metrics.get("normalized_cross_validation_mae")
    if not isinstance(normalized_cv, dict) or set(normalized_cv) != set(ALGORITHMS):
        raise ValueError("Artifact normalized cross-validation metrics are missing or incompatible")
    for algorithm, score in normalized_cv.items():
        if not isinstance(score, (float, int)) or not np.isfinite(score) or score < 0:
            raise ValueError(f"Artifact normalized cross-validation score for '{algorithm}' is malformed")
    selected_score = float(normalized_cv[bundle["algorithm"]])
    if not np.isclose(selected_score, min(normalized_cv.values()), rtol=0, atol=1e-12):
        raise ValueError("Artifact algorithm selection is inconsistent with cross-validation metrics")
    raw_cv_std = metrics.get("cross_validation_mae_std")
    if not isinstance(raw_cv_std, dict) or set(raw_cv_std) != set(normalized_cv):
        raise ValueError("Artifact cross-validation standard deviations are missing or incompatible")
    for algorithm, values in raw_cv_std.items():
        std_values = np.asarray(values, dtype=float)
        if std_values.shape != (len(TARGETS),) or not np.isfinite(std_values).all() or (std_values < 0).any():
            raise ValueError(f"Artifact cross-validation standard deviations for '{algorithm}' are malformed")
    normalized_cv_std = metrics.get("normalized_cross_validation_mae_std")
    if not isinstance(normalized_cv_std, dict) or set(normalized_cv_std) != set(normalized_cv):
        raise ValueError("Artifact normalized cross-validation dispersion is missing or incompatible")
    for algorithm, score in normalized_cv_std.items():
        if not isinstance(score, (float, int)) or not np.isfinite(score) or score < 0:
            raise ValueError(f"Artifact normalized cross-validation dispersion for '{algorithm}' is malformed")
    feature_importance = bundle.get("feature_importance")
    if not isinstance(feature_importance, dict) or set(feature_importance) != set(FEATURES):
        raise ValueError("Artifact feature importance is missing or incompatible")
    feature_importance_values = np.asarray(
        [feature_importance[feature] for feature in FEATURES],
        dtype=float,
    )
    if not np.isfinite(feature_importance_values).all() or (feature_importance_values < 0).any():
        raise ValueError("Artifact feature importance values must be finite and non-negative")
    if not np.isclose(feature_importance_values.sum(), 1.0, atol=1e-4):
        raise ValueError("Artifact feature importance must sum to 1")
    permutation = bundle.get("permutation_importance")
    if not isinstance(permutation, dict) or set(permutation) != set(FEATURES):
        raise ValueError("Artifact permutation importance is missing or incompatible")
    permutation_values = np.asarray([permutation[feature] for feature in FEATURES], dtype=float)
    if not np.isfinite(permutation_values).all() or (permutation_values < 0).any():
        raise ValueError("Artifact permutation importance values must be finite and non-negative")
    if not np.isclose(permutation_values.sum(), 1.0, atol=1e-4):
        raise ValueError("Artifact permutation importance must sum to 1")
    permutation_metadata = bundle.get("permutation_importance_metadata")
    if not isinstance(permutation_metadata, dict) or permutation_metadata.get("dataset") != "held-out":
        raise ValueError("Artifact permutation importance provenance is missing")
    feature_bounds = bundle.get("feature_bounds")
    if not isinstance(feature_bounds, dict) or set(feature_bounds) != set(FEATURES):
        raise ValueError("Artifact feature bounds are missing or incompatible")
    for feature in FEATURES:
        bounds = np.asarray(feature_bounds[feature], dtype=float)
        domain = np.asarray(FEATURE_RANGES[feature], dtype=float)
        if (
            bounds.shape != (2,)
            or not np.isfinite(bounds).all()
            or bounds[0] > bounds[1]
            or bounds[0] < domain[0]
            or bounds[1] > domain[1]
        ):
            raise ValueError(f"Artifact feature bound '{feature}' is malformed")
    return {
        "schemaVersion": bundle["schema_version"],
        "policyVersion": bundle["policy_version"],
        "version": bundle.get("version"),
        "source": bundle.get("source"),
        "trainingRows": bundle.get("training_rows", 0),
        "datasetFingerprint": fingerprint,
        "sklearnVersion": bundle.get("sklearn_version"),
    }


def benchmark_dataset(seed: int = 7, rows: int = 512):
    rng = np.random.default_rng(seed)
    x = np.column_stack(
        [
            rng.uniform(3, 21, rows),
            rng.integers(3, 25, rows),
            rng.integers(320, 2561, rows),
            rng.integers(568, 1441, rows),
            rng.uniform(1, 3, rows),
            rng.uniform(0.5, 100, rows),
            rng.integers(0, 2, rows),
        ]
    )
    pressure = np.clip((x[:, 5] / 12) + (x[:, 6] * 0.35), 0, 1)
    complexity_penalty = np.clip((x[:, 1] - 3) / 22, 0, 1)
    pixel_load = np.clip(
        (x[:, 2] * x[:, 3] * np.square(x[:, 4])) / (1280 * 800 * 2.25) - 0.1,
        0,
        1,
    )
    tilt = np.clip(45 + 22.5 * pressure - 10 * complexity_penalty - 5 * pixel_load, 35, 67.5)
    max_zoom = np.clip(15 + 6 * pressure - 2 * complexity_penalty - 1.5 * pixel_load, 15, 21)
    texture = np.clip(0.35 + 0.65 * pressure - 0.2 * complexity_penalty - 0.15 * pixel_load, 0, 1)
    return x, np.column_stack([tilt, max_zoom, texture])


def load_telemetry_dataset(rows):
    """Validate measured feature/target rows supplied by runtime telemetry."""
    required = FEATURES + TARGETS
    if not isinstance(rows, list) or not rows:
        raise ValueError("Telemetry dataset must be a non-empty JSON array")
    for row_number, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"Telemetry row {row_number} must be an object")
        missing = [key for key in required if key not in row]
        if missing:
            raise ValueError(
                f"Telemetry row {row_number} missing fields: {', '.join(missing)}"
            )
    raw_values = np.asarray([[float(row[key]) for key in required] for row in rows], dtype=float)
    if not np.isfinite(raw_values).all():
        raise ValueError("Telemetry values must be finite numbers")
    raw_features = raw_values[:, :len(FEATURES)]
    raw_targets = raw_values[:, len(FEATURES):]
    if len(raw_features) < 16:
        raise ValueError("Telemetry dataset requires at least 16 rows")
    validate_feature_values(raw_features)
    target_ranges = {
        "tilt": (35.0, 67.5),
        "max_zoom": (15.0, 21.0),
        "texture_quality_score": (0.0, 1.0),
    }
    for index, target in enumerate(TARGETS):
        lower, upper = target_ranges[target]
        if (raw_targets[:, index] < lower).any() or (raw_targets[:, index] > upper).any():
            raise ValueError(
                f"Telemetry target '{target}' must be between {lower:g} and {upper:g}"
            )
    if len(np.unique(raw_features, axis=0)) < 4:
        raise ValueError("Telemetry dataset requires at least 4 unique feature rows")
    if len(np.unique(raw_targets, axis=0)) < 2:
        raise ValueError("Telemetry dataset requires at least 2 unique target rows")
    selected_rows = select_best_telemetry_trials(rows)
    values = np.asarray(
        [[float(row[key]) for key in required] for row in selected_rows],
        dtype=float,
    )
    features = values[:, :len(FEATURES)]
    targets = values[:, len(FEATURES):]
    if len(features) < 16:
        raise ValueError("Telemetry dataset requires at least 16 unique runtime conditions")
    if len(np.unique(targets, axis=0)) < 2:
        raise ValueError("Optimized telemetry requires at least 2 unique target rows")
    return features, targets


def validate_telemetry_rows(rows):
    """Validate exported telemetry and return a machine-readable summary."""
    raw_trials = len(rows) if isinstance(rows, list) else 0
    features, targets = load_telemetry_dataset(rows)
    coverage = telemetry_action_coverage(rows)
    return {
        "rows": int(len(features)),
        "rawTrials": int(raw_trials),
        "optimizedContexts": int(len(features)),
        "uniqueFeatureRows": int(len(np.unique(features, axis=0))),
        "uniqueTargetRows": int(len(np.unique(targets, axis=0))),
        "features": len(FEATURES),
        "targets": len(TARGETS),
        "comparedContexts": coverage["comparedContexts"],
        "requiredComparedContexts": coverage["requiredComparedContexts"],
        "comparisonRate": coverage["comparisonRate"],
        "readyForPromotion": (
            len(features) >= MIN_PROMOTION_ROWS
            and coverage["comparedContexts"] >= coverage["requiredComparedContexts"]
        ),
        "selectionPolicy": "highest-detail-above-performance-floor",
        "minimumAcceptableTextureScore": MIN_ACCEPTABLE_TEXTURE_SCORE,
        "targetRanges": {
            target: [float(targets[:, index].min()), float(targets[:, index].max())]
            for index, target in enumerate(TARGETS)
        },
    }


def telemetry_action_coverage(rows):
    """Summarize paired rendering actions available for promotion evaluation."""
    if not isinstance(rows, list):
        raise ValueError("Telemetry rows must be a list")
    contexts = {}
    for row in rows:
        key = tuple(float(row[feature]) for feature in FEATURES)
        action = (float(row["tilt"]), float(row["max_zoom"]))
        contexts.setdefault(key, set()).add(action)
    compared = sum(len(actions) >= 2 for actions in contexts.values())
    required = max(
        MIN_PROMOTION_COMPARISON_CONTEXTS,
        math.ceil(len(contexts) * MIN_PROMOTION_COMPARISON_RATE),
    )
    return {
        "rawTrials": int(len(rows)),
        "runtimeContexts": int(len(contexts)),
        "comparedContexts": int(compared),
        "requiredComparedContexts": int(required),
        "comparisonRate": round(float(compared / len(contexts)), 6) if contexts else 0.0,
    }


def promotion_decision(
    champion_mae,
    candidate_mae,
    rows,
    minimum_rows=MIN_PROMOTION_ROWS,
    minimum_improvement=0.05,
    maximum_target_regression=0.15,
    compared_contexts=None,
    minimum_comparison_contexts=MIN_PROMOTION_COMPARISON_CONTEXTS,
    minimum_comparison_rate=MIN_PROMOTION_COMPARISON_RATE,
):
    """Return a normalized champion/challenger decision for measured telemetry."""
    champion = np.asarray(champion_mae, dtype=float)
    candidate = np.asarray(candidate_mae, dtype=float)
    if champion.shape != (len(TARGETS),) or candidate.shape != (len(TARGETS),):
        raise ValueError("Promotion metrics must contain one MAE per target")
    if not np.isfinite(champion).all() or not np.isfinite(candidate).all():
        raise ValueError("Promotion metrics must be finite")
    champion_score = float(np.mean(champion / TARGET_SPANS))
    candidate_score = float(np.mean(candidate / TARGET_SPANS))
    improvement = (
        (champion_score - candidate_score) / champion_score
        if champion_score > 1e-12
        else (0.0 if candidate_score <= 1e-12 else -1.0)
    )
    reasons = []
    required_comparison_contexts = max(
        minimum_comparison_contexts,
        math.ceil(rows * minimum_comparison_rate),
    )
    if rows < minimum_rows:
        reasons.append(f"Promotion requires at least {minimum_rows} measured rows")
    if compared_contexts is not None and compared_contexts < required_comparison_contexts:
        reasons.append(
            "Promotion requires at least "
            f"{required_comparison_contexts} runtime contexts with multiple measured actions"
        )
    if improvement < minimum_improvement:
        reasons.append(
            f"Normalized MAE improvement must be at least {minimum_improvement:.0%}"
        )
    for index, target in enumerate(TARGETS):
        allowed = champion[index] * (1 + maximum_target_regression)
        if candidate[index] > allowed + 1e-12:
            reasons.append(
                f"{target} MAE regressed by more than {maximum_target_regression:.0%}"
            )
    return {
        "eligible": not reasons,
        "rows": int(rows),
        "championMae": champion.round(4).tolist(),
        "candidateMae": candidate.round(4).tolist(),
        "championNormalizedMae": round(champion_score, 6),
        "candidateNormalizedMae": round(candidate_score, 6),
        "relativeImprovement": round(improvement, 6),
        "comparedContexts": None if compared_contexts is None else int(compared_contexts),
        "requiredComparedContexts": int(required_comparison_contexts),
        "reasons": reasons,
    }


def _telemetry_candidate_report(telemetry_path, champion_path, candidate_path):
    with telemetry_path.open("r", encoding="utf-8") as telemetry_file:
        telemetry_rows = json.load(telemetry_file)
        features, targets = load_telemetry_dataset(telemetry_rows)
    coverage = telemetry_action_coverage(telemetry_rows)
    if len(features) < MIN_PROMOTION_ROWS:
        raise ValueError(f"Promotion requires at least {MIN_PROMOTION_ROWS} measured rows")
    if coverage["comparedContexts"] < coverage["requiredComparedContexts"]:
        raise ValueError(
            "Promotion requires at least "
            f"{coverage['requiredComparedContexts']} runtime contexts with multiple measured actions"
        )
    champion = joblib.load(champion_path)
    validate_artifact_bundle(champion)
    train_model(candidate_path, telemetry_path=telemetry_path)
    candidate = joblib.load(candidate_path)
    validate_artifact_bundle(candidate)
    _, holdout_indices = next(validation_splits(features, None, splits=5))
    holdout_features = features[holdout_indices]
    holdout_targets = targets[holdout_indices]
    champion_mae = mean_absolute_error(
        holdout_targets,
        champion["model"].predict(holdout_features),
        multioutput="raw_values",
    )
    candidate_mae = candidate["metrics"]["holdout_mae"]
    report = promotion_decision(
        champion_mae,
        candidate_mae,
        len(features),
        compared_contexts=coverage["comparedContexts"],
    )
    report.update({
        "championFingerprint": champion["dataset_fingerprint"],
        "candidateFingerprint": candidate["dataset_fingerprint"],
        "candidateModel": candidate["version"],
        "candidateSource": candidate["source"],
        "evaluationRows": int(len(holdout_indices)),
        "evaluationStrategy": "shared-telemetry-holdout",
        "telemetryCoverage": coverage,
    })
    return report


def evaluate_telemetry_candidate(telemetry_path: Path, champion_path: Path):
    """Train a temporary challenger and report whether it clears promotion gates."""
    with tempfile.TemporaryDirectory() as directory:
        candidate_path = Path(directory) / "candidate.joblib"
        return _telemetry_candidate_report(telemetry_path, champion_path, candidate_path)


def promote_telemetry_model(telemetry_path: Path, champion_path: Path):
    """Atomically replace the champion only when measured telemetry wins the gate."""
    with telemetry_path.open("r", encoding="utf-8") as telemetry_file:
        features, _ = load_telemetry_dataset(json.load(telemetry_file))
    if len(features) < MIN_PROMOTION_ROWS:
        raise ValueError(f"Promotion requires at least {MIN_PROMOTION_ROWS} measured rows")
    champion_path.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, candidate_name = tempfile.mkstemp(
        prefix="3d-quality-candidate-",
        suffix=".joblib",
        dir=champion_path.parent,
    )
    os.close(file_descriptor)
    candidate_path = Path(candidate_name)
    try:
        report = _telemetry_candidate_report(telemetry_path, champion_path, candidate_path)
        report["promoted"] = False
        if not report["eligible"]:
            return report
        backup_path = champion_path.with_suffix(champion_path.suffix + ".previous")
        shutil.copy2(champion_path, backup_path)
        os.replace(candidate_path, champion_path)
        report["promoted"] = True
        report["backupPath"] = str(backup_path)
        return report
    finally:
        if candidate_path.exists():
            candidate_path.unlink()


def _polygon_area_m2(geometry):
    if len(geometry) < 3:
        return 0.0
    lat0 = math.radians(sum(point["lat"] for point in geometry) / len(geometry))
    points = [(math.radians(point["lon"]) * 6371000 * math.cos(lat0), math.radians(point["lat"]) * 6371000) for point in geometry]
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1])) / 2)


def _policy_targets(row):
    zoom, vertices, width, height, dpr, downlink, webgl = row
    pressure = np.clip((downlink / 12) + (webgl * 0.35), 0, 1)
    complexity = np.clip((vertices - 3) / 22, 0, 1)
    pixel_load = np.clip((width * height * (dpr ** 2)) / (1280 * 800 * 2.25) - 0.1, 0, 1)
    return [
        np.clip(45 + 22.5 * pressure - 10 * complexity - 5 * pixel_load, 35, 67.5),
        np.clip(15 + 6 * pressure - 2 * complexity - 1.5 * pixel_load + (zoom - 19) * 0.05, 15, 21),
        np.clip(0.35 + 0.65 * pressure - 0.2 * complexity - 0.15 * pixel_load, 0, 1),
    ]


def augment_runtime_conditions(rows, seed=7, return_groups=False):
    """Expand geometry rows across device/network conditions."""
    rng = np.random.default_rng(seed)
    augmented = []
    groups = []
    for group, base in enumerate(sorted(rows, key=lambda row: tuple(row))):
        for _ in range(4):
            row = list(base)
            row[0] = float(rng.choice([12, 15, 18, 19, 21]))
            row[2] = int(rng.choice([375, 768, 1280, 1440, 1920]))
            row[3] = int(rng.choice([667, 800, 900, 1080, 1200]))
            row[4] = float(rng.choice([1, 1.25, 1.5, 2, 3]))
            row[5] = float(rng.choice([0.5, 3, 10, 25, 75]))
            row[6] = int(rng.choice([0, 1]))
            augmented.append(row)
            groups.append(group)
    return (augmented, groups) if return_groups else augmented


def online_dataset(centers=ONLINE_CENTERS, limit=1800):
    """Download OSM building rows and turn geometry/tags into model examples."""
    rows = []
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
    ]
    for lat, lon in centers:
        query = f'[out:json][timeout:20];way["building"](around:1500,{lat},{lon});out tags geom;'
        payload = None
        for endpoint in endpoints:
            try:
                request = Request(endpoint + "?" + urlencode({"data": query}), headers={"User-Agent": "SolarScan-3D-Model/1.0"})
                with urlopen(request, timeout=30) as response:
                    payload = json.loads(response.read())
                break
            except Exception:
                continue
        if payload is None:
            continue
        for element in payload.get("elements", []):
            geometry = element.get("geometry", [])
            area = _polygon_area_m2(geometry)
            if area <= 4:
                continue
            tags = element.get("tags", {})
            levels = float(tags.get("building:levels", 1) or 1)
            vertices = max(3, min(24, len(geometry)))
            width = int(np.clip(math.sqrt(area) * 70, 320, 2560))
            height = int(np.clip(math.sqrt(area) * 45, 568, 1440))
            downlink = float(np.clip(18 - levels * 0.6 + vertices * 0.08, 0.5, 100))
            rows.append([19, vertices, width, height, 1.5, downlink, 1])
            if len(rows) >= limit:
                break
        if len(rows) >= limit:
            break
    if len(rows) < 8:
        raise RuntimeError(f"Overpass returned only {len(rows)} usable building rows")
    rows, groups = augment_runtime_conditions(rows, return_groups=True)
    return np.asarray(rows), np.asarray([_policy_targets(row) for row in rows]), np.asarray(groups)


def train_model(output: Path, online=False, telemetry_path: Path | None = None):
    source = "benchmark"
    groups = None
    if telemetry_path:
        with telemetry_path.open("r", encoding="utf-8") as telemetry_file:
            telemetry_rows = json.load(telemetry_file)
            x, y = load_telemetry_dataset(telemetry_rows)
        source = "telemetry"
    elif online:
        try:
            online_result = online_dataset()
            if len(online_result) == 3:
                x, y, groups = online_result
            else:
                x, y = online_result
            source = "openstreetmap-overpass"
        except Exception as error:
            print(f"Online dataset unavailable, using benchmark: {error}")
            x, y = benchmark_dataset()
    else:
        x, y = benchmark_dataset()
    if groups is None:
        train_indices, holdout_indices = next(
            iter(validation_splits(x, None, splits=5))
        )
    else:
        holdout_splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=7)
        train_indices, holdout_indices = next(holdout_splitter.split(x, y, groups=groups))
    x_train, x_holdout = x[train_indices], x[holdout_indices]
    y_train, y_holdout = y[train_indices], y[holdout_indices]
    candidates = {
        "random-forest": MultiOutputRegressor(
            RandomForestRegressor(n_estimators=96, random_state=7, min_samples_leaf=3, n_jobs=-1)
        ),
        "extra-trees": MultiOutputRegressor(
            ExtraTreesRegressor(n_estimators=96, random_state=7, min_samples_leaf=3, n_jobs=-1)
        ),
        "hist-gradient-boosting": MultiOutputRegressor(
            BaggingRegressor(
                estimator=HistGradientBoostingRegressor(
                    max_iter=120,
                    learning_rate=0.08,
                    max_leaf_nodes=31,
                    l2_regularization=0.1,
                    random_state=7,
                ),
                n_estimators=48,
                max_samples=1.0,
                bootstrap=True,
                random_state=7,
                n_jobs=-1,
            )
        ),
    }
    scores = {}
    cross_validation_scores = {}
    cross_validation_score_folds = {}
    selection_groups = groups[train_indices] if groups is not None else None
    for name, candidate in candidates.items():
        candidate = _clone_candidate_for_fit(candidate, len(x_train))
        candidates[name] = candidate
        candidate.fit(x_train, y_train)
        scores[name] = mean_absolute_error(y_holdout, candidate.predict(x_holdout), multioutput="raw_values").round(4).tolist()
        fold_scores = cross_validation_mae_folds(
            candidate,
            x_train,
            y_train,
            groups=selection_groups,
        )
        cross_validation_score_folds[name] = fold_scores
        cross_validation_scores[name] = fold_scores.mean(axis=0).round(4).tolist()
    cross_validation_mae_std = {
        name: fold_scores.std(axis=0).round(4).tolist()
        for name, fold_scores in cross_validation_score_folds.items()
    }
    normalized_cross_validation_scores = {
        name: normalized_target_mae(scores)
        for name, scores in cross_validation_scores.items()
    }
    normalized_cross_validation_mae_std = {
        name: float(np.std([normalized_target_mae(fold) for fold in fold_scores]))
        for name, fold_scores in cross_validation_score_folds.items()
    }
    algorithm = min(normalized_cross_validation_scores, key=normalized_cross_validation_scores.get)
    model = candidates[algorithm]
    holdout_predictions = model.predict(x_holdout)
    holdout_r2 = r2_score(y_holdout, holdout_predictions, multioutput="raw_values").round(4).tolist()
    baseline = DummyRegressor(strategy="mean").fit(x_train, y_train)
    baseline_holdout_mae = mean_absolute_error(
        y_holdout,
        baseline.predict(x_holdout),
        multioutput="raw_values",
    )
    selected_holdout_mae = mean_absolute_error(
        y_holdout,
        holdout_predictions,
        multioutput="raw_values",
    )
    baseline_normalized_mae = normalized_target_mae(baseline_holdout_mae)
    normalized_skill_vs_baseline = (
        1 - normalized_target_mae(selected_holdout_mae) / baseline_normalized_mae
        if baseline_normalized_mae > 1e-12
        else 0.0
    )
    permutation_importance_values = held_out_permutation_importance(model, x_holdout, y_holdout)
    uncertainty_scale = ensemble_uncertainty(model, x_holdout).round(4).tolist()
    diagnostics = cross_validation_diagnostics(
        model,
        x_train,
        y_train,
        groups=selection_groups,
    )
    diagnostic_errors = diagnostics["absolute_errors"]
    diagnostic_spreads = diagnostics["ensemble_spreads"]
    uncertainty_calibration_scale = (
        diagnostic_errors.mean(axis=0) / np.maximum(diagnostic_spreads.mean(axis=0), 1e-6)
    ).round(4).tolist()
    uncertainty_calibrators = [
        IsotonicRegression(y_min=0, out_of_bounds="clip").fit(
            diagnostic_spreads[:, index], diagnostic_errors[:, index]
        )
        for index in range(len(TARGETS))
    ]
    residual_level = conformal_quantile_level(len(diagnostic_errors), 0.9)
    residual_quantile_90 = np.quantile(
        diagnostic_errors,
        residual_level,
        axis=0,
        method="higher",
    )
    residual_coverage_90 = (diagnostic_errors <= residual_quantile_90).mean(axis=0)
    residual_quantile_90 = residual_quantile_90.round(4).tolist()
    residual_coverage_90 = residual_coverage_90.round(4).tolist()
    model = _clone_candidate_for_fit(model, len(x))
    model.fit(x, y)
    feature_bounds = {
        feature: [float(np.min(x[:, index])), float(np.max(x[:, index]))]
        for index, feature in enumerate(FEATURES)
    }
    member_importances = [
        getattr(estimator, "feature_importances_", None)
        for estimator in model.estimators_
    ]
    if all(value is not None for value in member_importances):
        importances = np.asarray(member_importances).mean(axis=0)
        importance_total = float(importances.sum())
        if importance_total:
            importances = importances / importance_total
        feature_importance = {
            feature: round(float(importances[index]), 6)
            for index, feature in enumerate(FEATURES)
        }
    else:
        feature_importance = permutation_importance_values.copy()
    novelty_detector = fit_feature_novelty_detector(x)
    output.parent.mkdir(parents=True, exist_ok=True)
    label_type = "measured-runtime-proxy" if source == "telemetry" else "synthetic-rendering-policy"
    warning = (
        "Texture quality is a proxy derived from frame time and map load latency."
        if source == "telemetry"
        else "Targets are policy labels, not measured visual quality."
    )
    bundle = {
        "model": model,
        "features": FEATURES,
        "targets": TARGETS,
        "feature_bounds": feature_bounds,
        "schema_version": SCHEMA_VERSION,
        "policy_version": POLICY_VERSION,
        "dataset_fingerprint": dataset_fingerprint(x, y),
        "sklearn_version": sklearn.__version__,
        "version": f"{algorithm}-v{POLICY_VERSION}",
        "algorithm": algorithm,
        "source": source,
        "training_rows": int(len(x)),
        "metrics": {
            "holdout_mae": scores[algorithm],
            "baseline_holdout_mae": baseline_holdout_mae.round(4).tolist(),
            "holdout_r2": holdout_r2,
            "normalized_skill_vs_baseline": round(float(normalized_skill_vs_baseline), 6),
            "candidate_mae": scores,
            "cross_validation_mae": cross_validation_scores,
            "cross_validation_mae_std": cross_validation_mae_std,
            "normalized_cross_validation_mae": normalized_cross_validation_scores,
            "normalized_cross_validation_mae_std": normalized_cross_validation_mae_std,
            "selection_metric": "normalized-cross-validation-mae",
            "selection_rows": int(len(x_train)),
            "calibration_rows": int(len(x_train)),
            "holdout_rows": int(len(x_holdout)),
            "evaluation_strategy": "grouped-building-holdout-and-cv" if groups is not None else "shuffled-holdout-and-cv",
            "evaluation_groups": int(len(np.unique(groups))) if groups is not None else int(len(x)),
            "uncertainty_scale": uncertainty_scale,
            "uncertainty_calibration_scale": uncertainty_calibration_scale,
            "residual_quantile_90": residual_quantile_90,
            "residual_coverage_90": residual_coverage_90,
            "residual_quantile_level_90": residual_level,
            "interval_calibration_method": "cross-conformal-finite-sample",
            "label_type": label_type,
            "warning": warning,
            "telemetry_selection_policy": (
                "highest-detail-above-performance-floor" if source == "telemetry" else None
            ),
            "minimum_acceptable_texture_score": (
                MIN_ACCEPTABLE_TEXTURE_SCORE if source == "telemetry" else None
            ),
        },
        "feature_importance": feature_importance,
        "permutation_importance": permutation_importance_values,
        "permutation_importance_metadata": {
            "dataset": "held-out",
            "scoring": "normalized-negative-mae",
            "repeats": 5,
            "random_state": 7,
        },
        "uncertainty_calibrators": uncertainty_calibrators,
        "novelty_detector": novelty_detector,
    }
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{output.name}.",
        suffix=".tmp",
        dir=output.parent,
    )
    os.close(file_descriptor)
    temporary_output = Path(temporary_name)
    try:
        joblib.dump(bundle, temporary_output)
        os.replace(temporary_output, output)
    finally:
        if temporary_output.exists():
            temporary_output.unlink()
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--online", action="store_true", help="Use public OSM/Overpass building data")
    parser.add_argument("--telemetry", type=Path, help="Train from a JSON array of measured feature/target rows")
    parser.add_argument("--output", type=Path, help="Write the artifact to a custom path")
    parser.add_argument("--validate-artifact", type=Path, help="Validate an existing joblib artifact without training")
    parser.add_argument("--validate-telemetry", type=Path, help="Validate exported telemetry without training")
    parser.add_argument("--evaluate-telemetry", type=Path, help="Evaluate measured telemetry as a challenger")
    parser.add_argument("--promote-telemetry", type=Path, help="Promote measured telemetry model when gates pass")
    parser.add_argument("--champion", type=Path, help="Champion artifact for telemetry evaluation/promotion")
    args = parser.parse_args()
    if args.validate_artifact:
        bundle = joblib.load(args.validate_artifact)
        print(json.dumps(validate_artifact_bundle(bundle), indent=2))
        raise SystemExit(0)
    if args.validate_telemetry:
        with args.validate_telemetry.open("r", encoding="utf-8") as telemetry_file:
            print(json.dumps(validate_telemetry_rows(json.load(telemetry_file)), indent=2))
        raise SystemExit(0)
    if args.evaluate_telemetry or args.promote_telemetry:
        telemetry_path = args.evaluate_telemetry or args.promote_telemetry
        champion_path = args.champion or (Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        try:
            report = (
                promote_telemetry_model(telemetry_path, champion_path)
                if args.promote_telemetry
                else evaluate_telemetry_candidate(telemetry_path, champion_path)
            )
        except ValueError as error:
            print(json.dumps({"eligible": False, "error": str(error)}, indent=2))
            raise SystemExit(2)
        print(json.dumps(report, indent=2))
        raise SystemExit(0 if report.get("eligible", False) or not args.promote_telemetry else 1)
    default_name = "3d_quality_candidate.joblib" if args.telemetry else "3d_quality_model.joblib"
    output = args.output or (Path(__file__).parent / "artifacts" / default_name)
    train_model(output, online=args.online, telemetry_path=args.telemetry)
