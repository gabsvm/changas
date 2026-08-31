import fs from "node:fs";

const MINIMUM_MOBILE_PERFORMANCE = 0.6;

for (const path of process.argv.slice(2)) {
  const report = JSON.parse(fs.readFileSync(path, "utf8"));
  const score = report.categories?.performance?.score ?? 0;
  if (score < MINIMUM_MOBILE_PERFORMANCE) {
    throw new Error(
      `${path} performance score ${score} is below ${MINIMUM_MOBILE_PERFORMANCE}`,
    );
  }
  console.log(`${path}: performance ${Math.round(score * 100)}`);
}
