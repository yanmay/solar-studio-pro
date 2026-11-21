import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import joblib
import numpy as np
from sklearn.base import BaseEstimator
from sklearn.ensemble import RandomForestRegressor
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LinearRegression
from sklearn.multioutput import MultiOutputRegressor
from sklearn.preprocessing import StandardScaler

from .train_3d_quality_model import (
    FEATURES,
    augment_runtime_conditions,
    benchmark_dataset,
    conformal_quantile_level,
    feature_distribution_penalty,
    feature_novelty_penalty,
    fit_feature_novelty_detector,
    load_telemetry_dataset,
    promotion_decision,
    promote_telemetry_model,
    normalized_target_mae,
    select_best_telemetry_trials,
    telemetry_action_coverage,
    cross_validation_diagnostics,
    _policy_targets,
    train_model,
    validation_splits,
    validate_artifact_bundle,
    validate_telemetry_rows,
    _telemetry_candidate_report,
)


class ThreeDQualityModelTests(unittest.TestCase):
    def test_runtime_requirements_pin_the_champion_sklearn_version(self):
        requirements = (
            Path(__file__).parents[1] / "api" / "requirements.txt"
        ).read_text(encoding="utf-8").splitlines()
        bundle = joblib.load(
            Path(__file__).parent / "artifacts" / "3d_quality_model.joblib"
        )
        self.assertIn(
            f"scikit-learn=={bundle['sklearn_version']}",
            [requirement.strip() for requirement in requirements],
        )

    def test_benchmark_is_reproducible(self):
        first = benchmark_dataset(seed=11, rows=16)
        second = benchmark_dataset(seed=11, rows=16)
        self.assertTrue((first[0] == second[0]).all())
        self.assertTrue((first[1] == second[1]).all())

    def test_artifact_contains_evaluation_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            self.assertEqual(bundle["source"], "benchmark")
            self.assertGreater(bundle["training_rows"], 0)
            self.assertIn("holdout_mae", bundle["metrics"])
            self.assertIn("baseline_holdout_mae", bundle["metrics"])
            self.assertEqual(len(bundle["metrics"]["baseline_holdout_mae"]), 3)
            self.assertIn("holdout_r2", bundle["metrics"])
            self.assertEqual(len(bundle["metrics"]["holdout_r2"]), 3)
            self.assertIn("normalized_skill_vs_baseline", bundle["metrics"])
            self.assertGreater(bundle["metrics"]["normalized_skill_vs_baseline"], 0)
            self.assertIn("label_type", bundle["metrics"])
            self.assertIn(bundle["algorithm"], {"random-forest", "extra-trees", "hist-gradient-boosting"})
            self.assertIn("uncertainty_scale", bundle["metrics"])
            self.assertIn("uncertainty_calibration_scale", bundle["metrics"])
            self.assertEqual(len(bundle["uncertainty_calibrators"]), 3)
            self.assertTrue(all(hasattr(calibrator, "predict") for calibrator in bundle["uncertainty_calibrators"]))
            self.assertIn("residual_quantile_90", bundle["metrics"])
            self.assertEqual(len(bundle["metrics"]["residual_quantile_90"]), 3)
            self.assertTrue(all(value >= 0 for value in bundle["metrics"]["residual_quantile_90"]))
            self.assertIn("residual_coverage_90", bundle["metrics"])
            self.assertEqual(len(bundle["metrics"]["residual_coverage_90"]), 3)
            self.assertTrue(all(0 <= value <= 1 for value in bundle["metrics"]["residual_coverage_90"]))
            self.assertEqual(bundle["metrics"]["interval_calibration_method"], "cross-conformal-finite-sample")
            self.assertGreaterEqual(bundle["metrics"]["residual_quantile_level_90"], 0.9)
            self.assertEqual(len(bundle["metrics"]["uncertainty_calibration_scale"]), 3)
            self.assertTrue(all(value > 0 for value in bundle["metrics"]["uncertainty_calibration_scale"]))
            self.assertIn("cross_validation_mae", bundle["metrics"])
            self.assertIn("cross_validation_mae_std", bundle["metrics"])
            self.assertEqual(len(bundle["metrics"]["cross_validation_mae_std"][bundle["algorithm"]]), 3)
            self.assertTrue(all(value >= 0 for value in bundle["metrics"]["cross_validation_mae_std"][bundle["algorithm"]]))
            self.assertEqual(bundle["metrics"]["selection_metric"], "normalized-cross-validation-mae")
            self.assertEqual(bundle["metrics"]["selection_rows"], 409)
            self.assertEqual(bundle["metrics"]["calibration_rows"], 409)
            self.assertEqual(bundle["metrics"]["holdout_rows"], 103)
            self.assertIn("normalized_cross_validation_mae", bundle["metrics"])
            self.assertEqual(
                set(bundle["metrics"]["normalized_cross_validation_mae"]),
                {"random-forest", "extra-trees", "hist-gradient-boosting"},
            )
            self.assertIn("normalized_cross_validation_mae_std", bundle["metrics"])
            self.assertGreaterEqual(bundle["metrics"]["normalized_cross_validation_mae_std"][bundle["algorithm"]], 0)
            self.assertEqual(
                bundle["algorithm"],
                min(bundle["metrics"]["normalized_cross_validation_mae"], key=bundle["metrics"]["normalized_cross_validation_mae"].get),
            )
            self.assertEqual(bundle["metrics"]["evaluation_strategy"], "shuffled-holdout-and-cv")
            self.assertEqual(set(bundle["feature_importance"]), set(bundle["features"]))
            self.assertAlmostEqual(sum(bundle["feature_importance"].values()), 1, places=4)
            self.assertEqual(set(bundle["permutation_importance"]), set(bundle["features"]))
            self.assertTrue(all(np.isfinite(value) and value >= 0 for value in bundle["permutation_importance"].values()))
            self.assertAlmostEqual(sum(bundle["permutation_importance"].values()), 1, places=4)
            self.assertEqual(bundle["permutation_importance_metadata"]["dataset"], "held-out")
            self.assertEqual(bundle["permutation_importance_metadata"]["scoring"], "normalized-negative-mae")
            self.assertEqual(bundle["schema_version"], 3)
            self.assertEqual(bundle["policy_version"], 2)
            self.assertTrue(bundle["version"].endswith("-v2"))
            self.assertEqual(len(bundle["dataset_fingerprint"]), 64)
            self.assertIn("sklearn_version", bundle)
            self.assertEqual(bundle["novelty_detector"]["reference_rows"], bundle["training_rows"])
            self.assertEqual(len(bundle["feature_bounds"]), 7)
            self.assertLess(
                bundle["feature_bounds"]["zoom"][0],
                bundle["feature_bounds"]["zoom"][1],
            )

    def test_normalized_target_mae_weights_targets_by_deployable_span(self):
        self.assertAlmostEqual(
            normalized_target_mae([3.25, 0.6, 0.1]),
            0.1,
            places=6,
        )

    def test_conformal_quantile_level_applies_finite_sample_rank_correction(self):
        self.assertEqual(conformal_quantile_level(10, 0.9), 1.0)
        self.assertGreater(conformal_quantile_level(100, 0.9), 0.9)

    def test_online_rows_are_augmented_across_runtime_conditions(self):
        rows = augment_runtime_conditions([[19, 8, 1200, 800, 1.5, 20, 1]], seed=3)
        self.assertGreaterEqual(len(rows), 4)
        self.assertGreater(len({row[0] for row in rows}), 1)
        self.assertGreater(len({row[5] for row in rows}), 1)

    def test_online_augmentation_preserves_building_groups(self):
        rows, groups = augment_runtime_conditions([
            [19, 8, 1200, 800, 1.5, 20, 1],
            [19, 12, 900, 700, 1.5, 15, 1],
        ], seed=3, return_groups=True)
        self.assertEqual(len(rows), len(groups))
        self.assertEqual(groups.count(0), 4)
        self.assertEqual(groups.count(1), 4)

    def test_online_augmentation_is_invariant_to_overpass_row_order(self):
        buildings = [
            [19, 8, 1200, 800, 1.5, 20, 1],
            [19, 12, 900, 700, 1.5, 15, 1],
        ]
        forward_rows, forward_groups = augment_runtime_conditions(
            buildings,
            seed=3,
            return_groups=True,
        )
        reverse_rows, reverse_groups = augment_runtime_conditions(
            list(reversed(buildings)),
            seed=3,
            return_groups=True,
        )
        self.assertEqual(forward_rows, reverse_rows)
        self.assertEqual(forward_groups, reverse_groups)

    def test_group_validation_splits_never_share_buildings(self):
        features = np.arange(56, dtype=float).reshape(8, 7)
        groups = np.asarray([0, 0, 0, 0, 1, 1, 1, 1])
        for train_indices, validation_indices in validation_splits(features, groups, splits=2):
            self.assertTrue(set(groups[train_indices]).isdisjoint(groups[validation_indices]))

    def test_online_artifact_records_group_aware_evaluation(self):
        features, targets = benchmark_dataset(seed=19, rows=24)
        groups = np.repeat(np.arange(6), 4)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            with patch(
                "ml.train_3d_quality_model.online_dataset",
                return_value=(features, targets, groups),
            ):
                train_model(output, online=True)
            bundle = joblib.load(output)
            self.assertEqual(
                bundle["metrics"]["evaluation_strategy"],
                "grouped-building-holdout-and-cv",
            )
            self.assertEqual(bundle["metrics"]["evaluation_groups"], 6)

    def test_telemetry_dataset_maps_named_features_and_targets(self):
        row = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        rows = []
        for index in range(16):
            sample = row.copy()
            sample["viewport_width"] += (index % 4) * 100
            sample["network_downlink_mbps"] += index
            sample["texture_quality_score"] = 0.7 + (index % 4) * 0.05
            rows.append(sample)
        features, targets = load_telemetry_dataset(rows)
        self.assertEqual(features.shape, (16, 7))
        self.assertEqual(targets.shape, (16, 3))
        self.assertEqual(float(targets[0, 0]), 62)

    def test_telemetry_dataset_is_invariant_to_export_row_order(self):
        rows = json.loads(
            Path(__file__).with_name("telemetry.example.json").read_text(encoding="utf-8")
        )
        forward_features, forward_targets = load_telemetry_dataset(rows)
        reverse_features, reverse_targets = load_telemetry_dataset(list(reversed(rows)))
        np.testing.assert_array_equal(forward_features, reverse_features)
        np.testing.assert_array_equal(forward_targets, reverse_targets)

    def test_telemetry_trial_selection_keeps_best_action_per_runtime_condition(self):
        base = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
        }
        trials = [
            {**base, "tilt": 45, "max_zoom": 18, "texture_quality_score": 0.55},
            {**base, "tilt": 60, "max_zoom": 20, "texture_quality_score": 0.9},
        ]
        selected = select_best_telemetry_trials(trials)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["tilt"], 60)
        self.assertEqual(selected[0]["max_zoom"], 20)

    def test_telemetry_trial_selection_prefers_more_detail_when_performance_is_acceptable(self):
        base = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
        }
        selected = select_best_telemetry_trials([
            {**base, "tilt": 45, "max_zoom": 18, "texture_quality_score": 0.95},
            {**base, "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.8},
        ])
        self.assertEqual(selected[0]["tilt"], 62)
        self.assertEqual(selected[0]["max_zoom"], 20)

    def test_telemetry_trial_selection_falls_back_to_performance_below_quality_floor(self):
        base = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
        }
        selected = select_best_telemetry_trials([
            {**base, "tilt": 45, "max_zoom": 18, "texture_quality_score": 0.8},
            {**base, "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.6},
        ])
        self.assertEqual(selected[0]["tilt"], 45)
        self.assertEqual(selected[0]["max_zoom"], 18)

    def test_telemetry_trial_selection_preserves_distinct_runtime_conditions(self):
        base = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 60, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        selected = select_best_telemetry_trials([
            base,
            {**base, "viewport_width": 375},
        ])
        self.assertEqual(len(selected), 2)

    def test_telemetry_trial_selection_normalizes_numeric_context_values(self):
        base = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 45, "max_zoom": 18, "texture_quality_score": 0.9,
        }
        string_context = {
            **base,
            **{feature: str(base[feature]) for feature in (
                "zoom", "roof_vertices", "viewport_width", "viewport_height",
                "device_pixel_ratio", "network_downlink_mbps", "webgl_available",
            )},
            "tilt": 62,
            "max_zoom": 20,
            "texture_quality_score": 0.8,
        }
        selected = select_best_telemetry_trials([base, string_context])
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["tilt"], 62)

    def test_cross_validation_diagnostics_returns_shared_oof_errors_spreads_and_residuals(self):
        features, targets = benchmark_dataset(seed=23, rows=48)
        candidate = MultiOutputRegressor(RandomForestRegressor(
            n_estimators=8,
            random_state=7,
            min_samples_leaf=2,
        ))
        diagnostics = cross_validation_diagnostics(candidate, features, targets, splits=3)
        self.assertEqual(diagnostics["absolute_errors"].shape, (48, 3))
        self.assertEqual(diagnostics["ensemble_spreads"].shape, (48, 3))
        np.testing.assert_array_equal(diagnostics["absolute_errors"], diagnostics["residuals"])
        self.assertTrue(np.isfinite(diagnostics["absolute_errors"]).all())
        self.assertTrue(np.isfinite(diagnostics["ensemble_spreads"]).all())

    def test_candidate_selection_cv_uses_training_partition_only(self):
        observed_rows = []

        def record_cv(_candidate, features, targets, splits=3, groups=None):
            observed_rows.append((len(features), len(targets), None if groups is None else len(groups)))
            return np.ones((splits, 3))

        with tempfile.TemporaryDirectory() as directory:
            with patch("ml.train_3d_quality_model.cross_validation_mae_folds", side_effect=record_cv):
                train_model(Path(directory) / "model.joblib")

        self.assertEqual(len(observed_rows), 3)
        self.assertEqual({rows for rows, _, _ in observed_rows}, {409})
        self.assertEqual({targets for _, targets, _ in observed_rows}, {409})
        self.assertEqual({groups for _, _, groups in observed_rows}, {None})

    def test_calibration_diagnostics_use_training_partition_only(self):
        observed_rows = []

        def record_diagnostics(_candidate, features, targets, splits=3, groups=None):
            observed_rows.append((len(features), len(targets), None if groups is None else len(groups)))
            return {
                "absolute_errors": np.ones((len(features), 3)),
                "residuals": np.ones((len(features), 3)),
                "ensemble_spreads": np.ones((len(features), 3)),
            }

        with tempfile.TemporaryDirectory() as directory:
            with patch("ml.train_3d_quality_model.cross_validation_diagnostics", side_effect=record_diagnostics):
                train_model(Path(directory) / "model.joblib")

        self.assertEqual(observed_rows, [(409, 409, None)])

    def test_telemetry_rejects_repeated_identical_rows(self):
        row = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        with self.assertRaisesRegex(ValueError, "at least 4 unique feature rows"):
            load_telemetry_dataset([row.copy() for _ in range(16)])

    def test_telemetry_rejects_impossible_feature_values(self):
        row = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 0,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        with self.assertRaisesRegex(ValueError, "viewport_width.*1"):
            load_telemetry_dataset([row.copy() for _ in range(16)])

    def test_telemetry_rejects_impossible_targets(self):
        row = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 90, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        with self.assertRaises(ValueError):
            load_telemetry_dataset([row.copy() for _ in range(16)])

        row["tilt"] = 20
        with self.assertRaisesRegex(ValueError, "tilt.*35"):
            load_telemetry_dataset([row.copy() for _ in range(16)])

    def test_telemetry_reports_missing_fields_in_later_rows(self):
        row = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        malformed = row.copy()
        del malformed["texture_quality_score"]
        with self.assertRaisesRegex(ValueError, "row 2.*texture_quality_score"):
            load_telemetry_dataset([row.copy(), malformed] + [row.copy() for _ in range(14)])

    def test_feature_distribution_penalty_flags_out_of_range_inputs(self):
        bounds = {name: [0.0, 10.0] for name in (
            "zoom", "roof_vertices", "viewport_width", "viewport_height",
            "device_pixel_ratio", "network_downlink_mbps", "webgl_available",
        )}
        self.assertEqual(feature_distribution_penalty(bounds, [[5] * 7]), 0)
        self.assertGreater(feature_distribution_penalty(bounds, [[20] * 7]), 0.9)

    def test_feature_novelty_penalty_distinguishes_known_and_unfamiliar_combinations(self):
        features, _ = benchmark_dataset(seed=13, rows=64)
        known = features[0:1]
        unfamiliar = np.asarray([[21, 100, 16384, 16384, 8, 1000, 1]], dtype=float)
        detector = fit_feature_novelty_detector(features)
        self.assertLess(feature_novelty_penalty(detector, known), 0.01)
        self.assertGreater(feature_novelty_penalty(detector, unfamiliar), 0.5)

    def test_policy_reduces_rendering_cost_for_high_pixel_load(self):
        low_pixel_load = _policy_targets([19, 8, 375, 667, 1, 25, 1])
        high_pixel_load = _policy_targets([19, 8, 1920, 1200, 3, 25, 1])
        self.assertLess(high_pixel_load[0], low_pixel_load[0])
        self.assertLess(high_pixel_load[1], low_pixel_load[1])
        self.assertLess(high_pixel_load[2], low_pixel_load[2])

    def test_telemetry_artifact_identifies_proxy_measurement_labels(self):
        row = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        with tempfile.TemporaryDirectory() as directory:
            telemetry = Path(directory) / "telemetry.json"
            output = Path(directory) / "model.joblib"
            telemetry_rows = []
            for index in range(16):
                sample = row.copy()
                sample["viewport_width"] = 375 + (index % 4) * 400
                sample["viewport_height"] = 667 + (index % 4) * 100
                sample["device_pixel_ratio"] = 1 + (index % 3) * 0.5
                sample["network_downlink_mbps"] = 3 + index
                sample["texture_quality_score"] = 0.6 + (index % 4) * 0.08
                telemetry_rows.append(sample)
            telemetry.write_text(json.dumps(telemetry_rows), encoding="utf-8")
            train_model(output, telemetry_path=telemetry)
            bundle = joblib.load(output)
            self.assertEqual(bundle["source"], "telemetry")
            self.assertEqual(bundle["metrics"]["label_type"], "measured-runtime-proxy")
            self.assertEqual(
                bundle["metrics"]["telemetry_selection_policy"],
                "highest-detail-above-performance-floor",
            )
            self.assertEqual(bundle["metrics"]["minimum_acceptable_texture_score"], 0.65)

    def test_cli_trains_from_exported_telemetry_json(self):
        row = {
            "zoom": 19, "roof_vertices": 6, "viewport_width": 1440,
            "viewport_height": 900, "device_pixel_ratio": 2,
            "network_downlink_mbps": 25, "webgl_available": 1,
            "tilt": 62, "max_zoom": 20, "texture_quality_score": 0.9,
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            telemetry = root / "3d-telemetry.json"
            output = root / "artifact.joblib"
            rows = []
            for index in range(16):
                sample = row.copy()
                sample["viewport_width"] = 375 + (index % 4) * 400
                sample["viewport_height"] = 667 + (index % 4) * 100
                sample["device_pixel_ratio"] = 1 + (index % 3) * 0.5
                sample["network_downlink_mbps"] = 3 + index
                sample["texture_quality_score"] = 0.6 + (index % 4) * 0.08
                rows.append(sample)
            telemetry.write_text(json.dumps(rows), encoding="utf-8")
            completed = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("train_3d_quality_model.py")), "--telemetry", str(telemetry), "--output", str(output)],
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertEqual(completed.returncode, 0)
            bundle = joblib.load(output)
            self.assertEqual(bundle["source"], "telemetry")
            self.assertEqual(bundle["training_rows"], 16)

    def test_artifact_validator_returns_machine_readable_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            summary = validate_artifact_bundle(bundle)
            self.assertEqual(summary["schemaVersion"], 3)
            self.assertEqual(summary["trainingRows"], bundle["training_rows"])
            self.assertEqual(summary["source"], "benchmark")

    def test_artifact_validator_rejects_malformed_interval_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            bundle["metrics"]["residual_quantile_90"] = [0.1]
            with self.assertRaisesRegex(ValueError, "residual_quantile_90"):
                validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_invalid_empirical_coverage(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            bundle["metrics"]["residual_coverage_90"][1] = 1.2
            with self.assertRaisesRegex(ValueError, "residual_coverage_90"):
                validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_malformed_cv_dispersion(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            bundle["metrics"]["cross_validation_mae_std"][bundle["algorithm"]] = [0.1]
            with self.assertRaisesRegex(ValueError, "standard deviations"):
                validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_malformed_evaluation_partition_sizes(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            bundle["metrics"]["selection_rows"] = bundle["training_rows"]
            with self.assertRaisesRegex(ValueError, "evaluation partition"):
                validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_feature_bounds_outside_runtime_domain(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            bundle["feature_bounds"]["zoom"] = [0.0, 21.0]
            with self.assertRaisesRegex(ValueError, "feature bound 'zoom'"):
                validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_malformed_baseline_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            train_model(output)
            bundle = joblib.load(output)
            bundle["metrics"]["holdout_r2"] = [1.1, 0.9, 0.8]
            with self.assertRaisesRegex(ValueError, "holdout_r2"):
                validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_unfitted_model(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["model"] = RandomForestRegressor()
        with self.assertRaisesRegex(ValueError, "not fitted"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_wrong_model_feature_count(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["model"] = RandomForestRegressor(random_state=7).fit(
            np.zeros((8, 6)),
            np.zeros(8),
        )
        with self.assertRaisesRegex(ValueError, "feature count"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_wrong_prediction_target_count(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["model"] = MultiOutputRegressor(RandomForestRegressor(random_state=7)).fit(
            np.zeros((8, 7)),
            np.zeros((8, 2)),
        )
        with self.assertRaisesRegex(ValueError, "target count"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_non_finite_prediction(self):
        class NonFiniteModel(BaseEstimator):
            def __init__(self):
                self.n_features_in_ = 7
                self.fitted_ = True

            def fit(self, features, targets):
                return self

            def predict(self, values):
                return np.full((len(values), 3), np.nan)

        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["model"] = NonFiniteModel()
        with self.assertRaisesRegex(ValueError, "non-finite"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_model_without_member_ensemble(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["model"] = MultiOutputRegressor(LinearRegression()).fit(
            np.zeros((8, 7)),
            np.zeros((8, 3)),
        )
        with self.assertRaisesRegex(ValueError, "ensemble structure"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_member_with_wrong_feature_count(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        member = bundle["model"].estimators_[0].estimators_[0]
        member.n_features_in_ = len(FEATURES) - 1
        with self.assertRaisesRegex(ValueError, "ensemble member feature count"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_unfitted_novelty_scaler(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["novelty_detector"] = dict(bundle["novelty_detector"])
        bundle["novelty_detector"]["scaler"] = StandardScaler()
        with self.assertRaisesRegex(ValueError, "novelty detector is not fitted"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_unfitted_uncertainty_calibrator(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["uncertainty_calibrators"] = list(bundle["uncertainty_calibrators"])
        bundle["uncertainty_calibrators"][0] = IsotonicRegression()
        with self.assertRaisesRegex(ValueError, "uncertainty calibrator 1 is not fitted"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_missing_sklearn_version(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle.pop("sklearn_version", None)
        with self.assertRaisesRegex(ValueError, "sklearn version"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_non_hexadecimal_dataset_fingerprint(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["dataset_fingerprint"] = "z" * 64
        with self.assertRaisesRegex(ValueError, "dataset fingerprint"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_inconsistent_model_identity(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["version"] = "random-forest-v2"
        with self.assertRaisesRegex(ValueError, "model identity"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_inconsistent_algorithm_selection(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        selected = bundle["algorithm"]
        bundle["metrics"] = dict(bundle["metrics"])
        bundle["metrics"]["normalized_cross_validation_mae"] = dict(
            bundle["metrics"]["normalized_cross_validation_mae"]
        )
        bundle["metrics"]["normalized_cross_validation_mae"][selected] = 10.0
        with self.assertRaisesRegex(ValueError, "algorithm selection"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_unknown_training_source(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["source"] = "unverified-import"
        with self.assertRaisesRegex(ValueError, "training source"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_inconsistent_training_row_provenance(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["training_rows"] += 1
        with self.assertRaisesRegex(ValueError, "training row"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_novelty_index_fitted_on_different_rows(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["novelty_detector"]["neighbors"].n_samples_fit_ -= 1
        with self.assertRaisesRegex(ValueError, "training row"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_malformed_feature_importance(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["feature_importance"] = dict(bundle["feature_importance"])
        bundle["feature_importance"][FEATURES[0]] = -0.1
        with self.assertRaisesRegex(ValueError, "feature importance"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_incompatible_sklearn_version(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["sklearn_version"] = "0.24.0"
        with self.assertRaisesRegex(ValueError, "sklearn version"):
            validate_artifact_bundle(bundle)

    def test_artifact_validator_rejects_incompatible_telemetry_selection_policy(self):
        bundle = joblib.load(Path(__file__).parent / "artifacts" / "3d_quality_model.joblib")
        bundle["source"] = "telemetry"
        bundle["metrics"] = dict(bundle["metrics"])
        bundle["metrics"]["telemetry_selection_policy"] = "fastest-action-only"
        bundle["metrics"]["minimum_acceptable_texture_score"] = 0.65
        with self.assertRaisesRegex(ValueError, "telemetry selection policy"):
            validate_artifact_bundle(bundle)

    def test_telemetry_validator_returns_dataset_summary_without_training(self):
        rows = json.loads(Path(__file__).with_name("telemetry.example.json").read_text(encoding="utf-8"))
        summary = validate_telemetry_rows(rows)
        self.assertEqual(summary["rows"], 16)
        self.assertEqual(summary["rawTrials"], 16)
        self.assertEqual(summary["optimizedContexts"], 16)
        self.assertGreaterEqual(summary["uniqueFeatureRows"], 4)
        self.assertEqual(summary["features"], 7)
        self.assertEqual(summary["targets"], 3)
        self.assertEqual(summary["comparedContexts"], 0)
        self.assertEqual(summary["comparisonRate"], 0)
        self.assertEqual(summary["requiredComparedContexts"], 32)
        self.assertFalse(summary["readyForPromotion"])
        self.assertEqual(summary["selectionPolicy"], "highest-detail-above-performance-floor")
        self.assertEqual(summary["minimumAcceptableTextureScore"], 0.65)

    def test_telemetry_action_coverage_detects_paired_profiles(self):
        rows = json.loads(Path(__file__).with_name("telemetry.example.json").read_text(encoding="utf-8"))
        paired = [rows[0], {**rows[0], "tilt": 55, "max_zoom": 19, "texture_quality_score": 0.7}]
        coverage = telemetry_action_coverage(paired)
        self.assertEqual(coverage["runtimeContexts"], 1)
        self.assertEqual(coverage["comparedContexts"], 1)
        self.assertEqual(coverage["comparisonRate"], 1.0)

    def test_promotion_requires_at_least_64_measured_rows(self):
        decision = promotion_decision(
            champion_mae=[1.0, 1.0, 0.1],
            candidate_mae=[0.5, 0.5, 0.05],
            rows=63,
        )
        self.assertFalse(decision["eligible"])
        self.assertIn("64", decision["reasons"][0])

    def test_promotion_blocks_a_single_target_regression(self):
        decision = promotion_decision(
            champion_mae=[2.0, 1.0, 0.1],
            candidate_mae=[1.0, 0.5, 0.12],
            rows=100,
        )
        self.assertFalse(decision["eligible"])
        self.assertTrue(any("texture_quality_score" in reason for reason in decision["reasons"]))

    def test_promotion_requires_paired_rendering_actions(self):
        decision = promotion_decision(
            champion_mae=[2.0, 1.0, 0.1],
            candidate_mae=[1.0, 0.5, 0.05],
            rows=100,
            compared_contexts=49,
        )
        self.assertFalse(decision["eligible"])
        self.assertEqual(decision["requiredComparedContexts"], 50)
        self.assertTrue(any("multiple measured actions" in reason for reason in decision["reasons"]))

    def test_candidate_report_compares_models_on_the_same_holdout_rows(self):
        features = np.arange(64 * 7, dtype=float).reshape(64, 7)
        targets = np.column_stack([
            np.arange(64, dtype=float),
            np.arange(64, dtype=float) / 10,
            np.arange(64, dtype=float) / 100,
        ])
        _, holdout_indices = next(validation_splits(features, None, splits=5))

        class RecordingModel:
            def __init__(self):
                self.seen = None

            def predict(self, values):
                self.seen = values.copy()
                return np.zeros((len(values), 3))

        champion_model = RecordingModel()
        champion = {"model": champion_model, "dataset_fingerprint": "a" * 64}
        candidate = {
            "algorithm": "extra-trees",
            "dataset_fingerprint": "b" * 64,
            "version": "extra-trees-v2",
            "source": "telemetry",
            "metrics": {
                "holdout_mae": [1.0, 0.5, 0.05],
                "cross_validation_mae": {"extra-trees": [9.0, 9.0, 0.9]},
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            telemetry = Path(directory) / "telemetry.json"
            telemetry.write_text("[]", encoding="utf-8")
            with patch("ml.train_3d_quality_model.load_telemetry_dataset", return_value=(features, targets)), patch(
                "ml.train_3d_quality_model.joblib.load", side_effect=[champion, candidate]
            ), patch("ml.train_3d_quality_model.validate_artifact_bundle"), patch(
                "ml.train_3d_quality_model.train_model"
            ), patch(
                "ml.train_3d_quality_model.telemetry_action_coverage",
                return_value={
                    "rawTrials": 64,
                    "runtimeContexts": 32,
                    "comparedContexts": 32,
                    "requiredComparedContexts": 32,
                    "comparisonRate": 1.0,
                },
            ):
                report = _telemetry_candidate_report(telemetry, Path("champion.joblib"), Path("candidate.joblib"))

        np.testing.assert_array_equal(champion_model.seen, features[holdout_indices])
        self.assertEqual(report["candidateMae"], [1.0, 0.5, 0.05])
        self.assertEqual(report["evaluationRows"], len(holdout_indices))
        self.assertEqual(report["evaluationStrategy"], "shared-telemetry-holdout")

    def test_candidate_report_validates_challenger_before_comparison(self):
        features, targets = benchmark_dataset(seed=31, rows=64)
        candidate = {
            "algorithm": "extra-trees",
            "dataset_fingerprint": "b" * 64,
            "version": "extra-trees-v2",
            "source": "telemetry",
            "metrics": {"holdout_mae": [1.0, 0.5, 0.05]},
        }
        champion = {
            "model": type("Model", (), {"predict": lambda _self, values: np.zeros((len(values), 3))})(),
            "dataset_fingerprint": "a" * 64,
        }
        validation_calls = []

        def validate(bundle):
            validation_calls.append(bundle)
            if bundle is candidate:
                raise ValueError("challenger artifact is invalid")

        with tempfile.TemporaryDirectory() as directory:
            telemetry = Path(directory) / "telemetry.json"
            telemetry.write_text("[]", encoding="utf-8")
            with patch("ml.train_3d_quality_model.load_telemetry_dataset", return_value=(features, targets)), patch(
                "ml.train_3d_quality_model.joblib.load", side_effect=[champion, candidate]
            ), patch("ml.train_3d_quality_model.validate_artifact_bundle", side_effect=validate), patch(
                "ml.train_3d_quality_model.train_model"
            ), patch(
                "ml.train_3d_quality_model.telemetry_action_coverage",
                return_value={
                    "rawTrials": 64,
                    "runtimeContexts": 64,
                    "comparedContexts": 32,
                    "requiredComparedContexts": 32,
                    "comparisonRate": 0.5,
                },
            ):
                with self.assertRaisesRegex(ValueError, "challenger artifact"):
                    _telemetry_candidate_report(telemetry, Path("champion.joblib"), Path("candidate.joblib"))

        self.assertEqual(validation_calls, [champion, candidate])

    def test_candidate_evaluation_rejects_missing_action_comparisons_before_training(self):
        fixture = json.loads(Path(__file__).with_name("telemetry.example.json").read_text(encoding="utf-8"))
        rows = []
        for batch in range(4):
            for row in fixture:
                rows.append({**row, "viewport_width": row["viewport_width"] + batch})
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            telemetry = root / "telemetry.json"
            telemetry.write_text(json.dumps(rows), encoding="utf-8")
            with patch("ml.train_3d_quality_model.train_model") as train:
                with self.assertRaisesRegex(ValueError, "multiple measured actions"):
                    _telemetry_candidate_report(
                        telemetry,
                        root / "champion.joblib",
                        root / "candidate.joblib",
                    )
                train.assert_not_called()

    def test_failed_promotion_preserves_the_champion_artifact(self):
        telemetry = Path(__file__).with_name("telemetry.example.json")
        with tempfile.TemporaryDirectory() as directory:
            champion = Path(directory) / "champion.joblib"
            champion.write_bytes(b"existing champion")
            with self.assertRaisesRegex(ValueError, "64 measured rows"):
                promote_telemetry_model(telemetry, champion)
            self.assertEqual(champion.read_bytes(), b"existing champion")

    def test_successful_promotion_replaces_champion_and_keeps_backup(self):
        fixture = json.loads(Path(__file__).with_name("telemetry.example.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            telemetry = root / "telemetry.json"
            rows = []
            for batch in range(4):
                for row in fixture:
                    rows.append({**row, "viewport_width": row["viewport_width"] + batch})
            telemetry.write_text(json.dumps(rows), encoding="utf-8")
            champion = root / "champion.joblib"
            champion.write_bytes(b"existing champion")

            def eligible_report(_telemetry, _champion, candidate):
                candidate.write_bytes(b"approved candidate")
                return {"eligible": True}

            with patch(
                "ml.train_3d_quality_model._telemetry_candidate_report",
                side_effect=eligible_report,
            ):
                report = promote_telemetry_model(telemetry, champion)

            self.assertTrue(report["promoted"])
            self.assertEqual(champion.read_bytes(), b"approved candidate")
            self.assertEqual(
                champion.with_suffix(".joblib.previous").read_bytes(),
                b"existing champion",
            )

    def test_failed_artifact_serialization_preserves_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "model.joblib"
            output.write_bytes(b"existing-champion")

            def fail_after_partial_write(_bundle, path):
                Path(path).write_bytes(b"partial-artifact")
                raise OSError("simulated serialization failure")

            with patch(
                "ml.train_3d_quality_model.joblib.dump",
                side_effect=fail_after_partial_write,
            ):
                with self.assertRaisesRegex(OSError, "serialization failure"):
                    train_model(output)

            self.assertEqual(output.read_bytes(), b"existing-champion")


if __name__ == "__main__":
    unittest.main()
