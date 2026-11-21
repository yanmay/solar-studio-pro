import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import joblib


MODULE_PATH = Path(__file__).with_name("3d-profile.py")
SPEC = importlib.util.spec_from_file_location("three_d_profile", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ThreeDProfileTests(unittest.TestCase):
    def test_missing_champion_fails_closed_without_training_a_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            missing_path = Path(directory) / "missing.joblib"
            with patch.object(MODULE, "MODEL", None), patch.object(MODULE, "MODEL_PATH", missing_path), patch.object(joblib, "load") as load_model:
                with self.assertRaisesRegex(FileNotFoundError, "champion artifact"):
                    MODULE.get_model()
                load_model.assert_not_called()

    def test_in_range_profile_reports_low_distribution_penalty(self):
        result = MODULE.profile({
            "zoom": 19,
            "roofVertices": 8,
            "viewportWidth": 1440,
            "viewportHeight": 900,
            "devicePixelRatio": 2,
            "networkDownlinkMbps": 25,
            "webglAvailable": True,
        })
        self.assertIn("distributionPenalty", result)
        self.assertLessEqual(result["distributionPenalty"], 0.01)
        self.assertEqual(set(result["featureImportance"]), set(result["features"]))
        self.assertEqual(set(result["permutationImportance"]), set(result["features"]))
        self.assertEqual(result["schemaVersion"], 3)
        self.assertIn("neighborPenalty", result)
        self.assertIn("expectedErrorByTarget", result)
        self.assertEqual(len(result["expectedErrorByTarget"]), 3)
        self.assertIn("calibratedUncertaintyByTarget", result)
        self.assertEqual(len(result["calibratedUncertaintyByTarget"]), 3)
        self.assertEqual(result["uncertaintyCalibrationMethod"], "isotonic-out-of-fold")
        self.assertIn("predictionIntervalByTarget", result)
        self.assertEqual(len(result["predictionIntervalByTarget"]), 3)
        self.assertIn("intervalHalfWidthByTarget", result)
        self.assertEqual(len(result["intervalHalfWidthByTarget"]), 3)
        self.assertEqual(result["intervalCoverage"], 0.9)
        self.assertEqual(result["intervalCalibrationMethod"], "cross-conformal-finite-sample")
        self.assertIn("empiricalIntervalCoverageByTarget", result)
        self.assertEqual(len(result["empiricalIntervalCoverageByTarget"]), 3)
        self.assertTrue(all(0 <= value <= 1 for value in result["empiricalIntervalCoverageByTarget"]))
        self.assertEqual(result["policyVersion"], 2)
        self.assertEqual(len(result["datasetFingerprint"]), 64)

    def test_out_of_distribution_profile_lowers_confidence(self):
        result = MODULE.profile({
            "zoom": 3,
            "roofVertices": 100,
            "viewportWidth": 320,
            "viewportHeight": 568,
            "devicePixelRatio": 3,
            "networkDownlinkMbps": 0.5,
            "webglAvailable": False,
        })
        self.assertGreater(result["distributionPenalty"], 0.1)
        self.assertGreaterEqual(result["confidence"], 0)
        self.assertLessEqual(result["confidence"], 1)

    def test_in_domain_but_unfamiliar_combination_gets_neighbor_penalty(self):
        result = MODULE.profile({
            "zoom": 12,
            "roofVertices": 24,
            "viewportWidth": 1920,
            "viewportHeight": 1200,
            "devicePixelRatio": 3,
            "networkDownlinkMbps": 75,
            "webglAvailable": False,
        })
        self.assertEqual(result["boundsPenalty"], 0)
        self.assertGreater(result["neighborPenalty"], 0.5)
        self.assertLess(result["confidence"], 0.5)

    def test_out_of_distribution_profile_widens_prediction_intervals(self):
        known = MODULE.profile({
            "zoom": 19, "roofVertices": 8, "viewportWidth": 1440,
            "viewportHeight": 900, "devicePixelRatio": 2,
            "networkDownlinkMbps": 25, "webglAvailable": True,
        })
        unfamiliar = MODULE.profile({
            "zoom": 12, "roofVertices": 24, "viewportWidth": 1920,
            "viewportHeight": 1200, "devicePixelRatio": 3,
            "networkDownlinkMbps": 75, "webglAvailable": False,
        })
        known_widths = known["intervalHalfWidthByTarget"]
        unfamiliar_widths = unfamiliar["intervalHalfWidthByTarget"]
        self.assertTrue(all(a >= b for a, b in zip(unfamiliar_widths, known_widths)))

    def test_profile_rejects_impossible_runtime_features(self):
        invalid_payloads = [
            {"viewportWidth": 0},
            {"viewportHeight": -1},
            {"devicePixelRatio": 0},
            {"networkDownlinkMbps": -0.1},
            {"webglAvailable": "yes"},
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    MODULE.profile(payload)

    def test_profile_rejects_artifact_with_malformed_interval_metadata(self):
        original = MODULE.MODEL
        try:
            MODULE.MODEL = dict(MODULE.get_model())
            MODULE.MODEL["metrics"] = dict(MODULE.MODEL["metrics"])
            MODULE.MODEL["metrics"]["residual_coverage_90"] = [1.2, 0.9, 0.9]
            with self.assertRaises(ValueError):
                MODULE.profile({})
        finally:
            MODULE.MODEL = original


if __name__ == "__main__":
    unittest.main()
