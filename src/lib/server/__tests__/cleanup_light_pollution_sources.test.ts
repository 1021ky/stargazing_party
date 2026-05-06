import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");
const searchTargets = [
  path.join(repoRoot, "src"),
  path.join(repoRoot, "jest.setup.ts"),
];
const forbiddenPatterns = [
  ["black", "_", "marble", "_", "api", "_", "client"].join(""),
  ["get", "Black", "Marble", "Proxy"].join(""),
  ["BLACK", "_", "MARBLE", "_", "POINT", "_", "QUERY", "_", "ENDPOINT"].join(
    "",
  ),
  ["BLACK", "_", "MARBLE", "_", "DATASET", "_", "YEAR"].join(""),
  ["black", "-", "marble", "-", "vnp46a4"].join(""),
  ["black", "-", "marble", "-", "vnp46a4", "-", "gap", "-", "filled"].join(""),
  ["NearNadir", "_", "Composite", "_", "Snow", "_", "Free"].join(""),
  [
    "NearNadir",
    "_",
    "Composite",
    "_",
    "Snow",
    "_",
    "Free",
    "_",
    "Quality",
  ].join(""),
];

describe("light pollution source cleanup", () => {
  it.each(forbiddenPatterns)(
    "source tree に '%s' が残っていない",
    (pattern) => {
      const result = spawnSync("grep", ["-RIn", pattern, ...searchTargets], {
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    },
  );
});
