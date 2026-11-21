# 3D View Quality Model

This model recommends a rendering profile for the interactive rooftop view. It
does not generate satellite imagery and does not claim to improve Google's
photogrammetry. The input features are measurable client/runtime signals:

- map zoom and roof polygon complexity
- viewport dimensions and device pixel ratio
- network quality and WebGL availability

The training script uses a deterministic benchmark label function so the model
can be retrained reproducibly until production telemetry is available. Replace
the benchmark rows with anonymized telemetry before using the predictions for
product decisions.

Online OSM geometry is expanded across multiple zoom, viewport, device-pixel,
network, and WebGL conditions. This makes those runtime features learnable, but
the targets remain rendering-policy labels until measured visual-quality or
frame-time telemetry is collected.
Geometry rows are sorted before deterministic runtime augmentation, so Overpass
response ordering does not change the generated dataset or artifact fingerprint.

Run:

```bash
python ml/train_3d_quality_model.py
# Download public OSM building geometry and train from it when available:
python ml/train_3d_quality_model.py --online
```

The same workflows are available through npm: `npm run ml:train`,
`npm run ml:train:online`, and `npm run ml:test`. Install
`api/requirements.txt` into the Python interpreter used by those commands
first. Set `SOLAR_PYTHON` when the desired interpreter is not in the default
Windows/macOS/Linux search paths.

The trainer compares Random Forest, Extra Trees, and a bootstrap ensemble of
Histogram Gradient Boosting regressors on a holdout split and
three-fold cross-validation over the training partition only. The untouched
holdout therefore does not influence algorithm selection. It then persists the candidate with the lowest
target-span-normalized CV MAE so tilt's larger numeric scale cannot dominate
zoom and texture quality. Raw per-target MAE remains in the artifact for audits.
Per-target and normalized CV standard deviations are persisted alongside the
means so fold-to-fold model stability can be inspected through API metrics.
Each artifact evaluates a `DummyRegressor` mean baseline on the same holdout
and records per-target R2 plus normalized skill over that baseline. The
deployable model is written to `ml/artifacts/3d_quality_model.joblib`. The artifact also stores averaged
feature importance across the multi-output estimators for API diagnostics. It
also stores held-out permutation importance using normalized negative MAE.
Artifacts include a schema version, rendering-policy version, sklearn version,
and SHA-256 dataset fingerprint. The API rejects bundles whose schema, feature
order, target order, or fingerprint is incompatible with the deployed code.
The API runtime pins the sklearn minor version used to build the checked-in
champion. Artifact validation also checks that the declared algorithm is the
lowest persisted normalized CV-MAE candidate, that every ensemble member was
fit with the declared feature width and row count, and that feature
importance metadata is finite and normalized. Missing champion artifacts fail
closed; the endpoint never trains a synthetic fallback during inference.
The artifact is intentionally kept deployable in this repository so the API
does not retrain on every cold start.
The artifact metadata records whether `benchmark` or
`openstreetmap-overpass` supplied its training rows.

For measured runtime data, provide a JSON array containing every field in
`FEATURES` and `TARGETS`, then run `python ml/train_3d_quality_model.py
--telemetry path/to/telemetry.json` (or `npm run ml:train:telemetry` with
`ml/telemetry.json`). At least 16 rows are required; the artifact records
`source: telemetry` and the observed min/max bounds for every feature. The API
returns `distributionPenalty` when runtime inputs fall outside those bounds;
that penalty lowers confidence instead of presenting an extrapolated profile
as equally reliable.

Schema 3 artifacts also persist a standardized nearest-neighbor novelty
detector. `distributionPenalty` is the larger of the simple bounds penalty and
the neighbor-combination penalty, so unfamiliar combinations inside individual
min/max ranges still reduce confidence.

Training also calibrates tree-ensemble spread against held-out absolute error.
The API exposes `calibratedUncertaintyByTarget` and `expectedErrorByTarget`, and
confidence uses the calibrated uncertainty rather than treating raw tree spread
as an error probability.
Per-target isotonic regressors learn the monotonic spread-to-error relationship
from out-of-fold predictions. The earlier scalar ratio remains an inference
fallback for compatible artifacts without isotonic calibrators.
The selected ensemble is fitted only once per diagnostic fold inside the
training partition: those same out-of-fold predictions and member spreads feed
scalar uncertainty calibration, the isotonic regressors, and conformal residual
intervals. This keeps all three diagnostics on an identical evaluation population,
avoids redundant fits, and leaves the final holdout untouched. New artifacts
record selection, calibration, and holdout row counts for auditability.

Three-fold held-out absolute residuals also calibrate a per-target 90% prediction
interval. The API returns `predictionIntervalByTarget`,
`intervalHalfWidthByTarget`, and `intervalCoverage`. Out-of-distribution penalties
widen these intervals before they are clipped to deployable target ranges.
The residual cutoff uses the finite-sample conformal rank correction and the
conservative higher order statistic instead of an interpolated raw percentile.
Artifacts also persist `residual_coverage_90`, exposed as
`empiricalIntervalCoverageByTarget`, so achieved held-out coverage can be audited
against the nominal 90% level.

Schema validation rejects calibration arrays with missing targets, non-finite or
out-of-range values, malformed feature bounds, or incompatible feature/target
ordering before the API serves a prediction.

Online OSM evaluation is grouped by source building. All four augmented runtime
variants of a building remain in the same holdout or cross-validation fold,
preventing related samples from leaking into both training and validation. The
artifact records `evaluation_strategy` and `evaluation_groups` in its metrics.

Telemetry also needs at least four unique feature combinations and two unique
target rows. Repeated samples for the same runtime condition are replaced by
the latest observation in browser storage, preventing validation metrics from
being inflated by duplicates.
Telemetry contexts are canonically ordered before fitting, so exporting the
same observations in a different JSON order produces the same optimized
dataset and dataset fingerprint.

Browser measurements remain local until the user presses the upload control.
During local development, `POST /api/3d-telemetry` validates, deduplicates, and
stores at most 500 rows in the ignored `ml/telemetry.json` file. Once at least
16 rows have been collected, run `npm run ml:validate:telemetry --
ml/telemetry.json` and `npm run ml:train:telemetry`. The download control remains
the portable fallback for deployments without persistent server-side storage.

Use the calibration control to measure bounded lower- and higher-detail profiles.
Distinct tilt/max-zoom actions are retained for the same runtime condition. Before
fitting, sklearn groups those trials by runtime features. Among actions whose
measured texture-quality score is at least `0.65`, it uses the highest normalized
tilt/zoom detail as the supervised policy target; if no action clears that floor,
it falls back to the action with the best measured performance score. This avoids
training a degenerate fastest-only policy while preserving a safe fallback. API
readiness is based on optimized runtime contexts, not the raw number of trials;
validation reports `rawTrials`, `optimizedContexts`, `comparedContexts`,
`comparisonRate`, and `readyForPromotion`. The 3D control strip shows comparison
progress as `compared/32` and switches to `READY` after both collection gates pass.

Training and inference reject non-finite or impossible runtime values. The
supported domain is zoom 3–21, roof vertices 3–100, viewport dimensions
1–16384, device pixel ratio 0.1–8, network downlink 0–1000 Mbps, and a boolean
WebGL availability signal.

The browser's 3D view records one anonymized sample after the map tiles load.
It measures map-load latency and a short animation-frame sample, derives a
bounded `texture_quality_score` proxy, and keeps at most 500 rows in local
storage. Use the download button in the 3D controls to export
`3d-telemetry.json`, then train with `--telemetry`. No telemetry is uploaded
automatically.

To train a separate artifact from an exported file:

```bash
python ml/train_3d_quality_model.py --telemetry ml/telemetry.example.json --output /tmp/3d-telemetry-model.joblib
```

The resulting artifact reports `source: telemetry` and
`label_type: measured-runtime-proxy`. The checked-in example is a workflow
fixture, not production measurement data.

Telemetry training defaults to `ml/artifacts/3d_quality_candidate.joblib` so a
measured model cannot silently replace the deployed champion. Evaluate a
candidate with:

```bash
python ml/train_3d_quality_model.py --evaluate-telemetry ml/telemetry.json \
  --champion ml/artifacts/3d_quality_model.joblib
# or: npm run ml:evaluate:telemetry
```

Promotion requires at least 64 optimized measured runtime contexts and paired
actions in at least half of the optimized contexts, with a floor of 32 compared
contexts. It also requires at least 5% lower
normalized multi-target MAE, and no target regressing by more than 15%. Missing
comparison coverage is rejected before challenger fitting. A passing promotion
atomically replaces the champion and writes a `.previous` backup; a rejected
candidate leaves the champion unchanged.
Champion and challenger MAE are computed on the same deterministic telemetry
holdout, so promotion never compares full-dataset error with cross-validation
error from a different evaluation population.
Both champion and challenger artifacts are schema-validated before any
promotion metric is consumed.

Validate the deployable bundle without retraining:

```bash
python ml/train_3d_quality_model.py --validate-artifact ml/artifacts/3d_quality_model.joblib
# or: npm run ml:validate
```

Training writes artifacts through a same-directory temporary file and atomic
replacement, so a failed sklearn/joblib serialization cannot truncate an
existing champion or candidate.

Validate an export before fitting:

```bash
python ml/train_3d_quality_model.py --validate-telemetry ml/telemetry.example.json
# or: npm run ml:validate:telemetry
```
