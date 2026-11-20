const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const mode = process.argv[2] || "test";
const extraArgs = process.argv.slice(3);
const argsByMode = {
  test: ["-m", "unittest", "ml.test_train_3d_quality_model", "api.test_3d_profile"],
  train: ["ml/train_3d_quality_model.py"],
  online: ["ml/train_3d_quality_model.py", "--online"],
  validate: ["ml/train_3d_quality_model.py", "--validate-artifact", "ml/artifacts/3d_quality_model.joblib"],
  telemetry: ["ml/train_3d_quality_model.py", "--validate-telemetry", "ml/telemetry.example.json"],
  evaluate: ["ml/train_3d_quality_model.py", "--evaluate-telemetry", "ml/telemetry.json", "--champion", "ml/artifacts/3d_quality_model.joblib"],
  promote: ["ml/train_3d_quality_model.py", "--promote-telemetry", "ml/telemetry.json", "--champion", "ml/artifacts/3d_quality_model.joblib"],
};
const args = argsByMode[mode];
if (!args) {
  console.error(`Unknown ML mode: ${mode}. Use test, train, online, validate, telemetry, evaluate, or promote.`);
  process.exit(2);
}
const commandArgs = mode === "telemetry" && extraArgs.length
  ? ["ml/train_3d_quality_model.py", "--validate-telemetry", extraArgs[0], ...extraArgs.slice(1)]
  : [...args, ...extraArgs];

const candidates = [];
if (process.env.SOLAR_PYTHON) candidates.push(process.env.SOLAR_PYTHON);
if (process.platform === "win32" && process.env.LOCALAPPDATA) {
  candidates.push(join(process.env.LOCALAPPDATA, "Programs", "Python", "Python313", "python.exe"));
}
candidates.push(process.platform === "win32" ? "py" : "python3", "python");

for (const executable of candidates) {
  if (executable.includes("\\") && !existsSync(executable)) continue;
  const prefix = executable === "py" ? ["-3.13"] : [];
  const probe = spawnSync(executable, [...prefix, "-c", "import numpy,joblib,sklearn"], { stdio: "ignore" });
  if (probe.error?.code === "ENOENT" || probe.status !== 0) continue;
  const result = spawnSync(executable, [...prefix, ...commandArgs], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

console.error("No usable Python interpreter found. Set SOLAR_PYTHON to one with api/requirements.txt installed.");
process.exit(1);
