import fs from "node:fs";

const minimums = {
  performance: 0.6,
  accessibility: 0.85,
  "best-practices": 0.85,
  seo: 0.9,
};

const paths = process.argv.slice(2);
if (paths.length === 0) {
  throw new Error("At least one Lighthouse JSON report is required.");
}

for (const path of paths) {
  const report = JSON.parse(fs.readFileSync(path, "utf8"));
  const summary = [];

  for (const [category, minimum] of Object.entries(minimums)) {
    const score = report.categories?.[category]?.score;
    if (typeof score !== "number") {
      throw new Error(`${path} is missing Lighthouse category ${category}`);
    }
    if (score < minimum) {
      throw new Error(`${path} ${category} score ${score} is below ${minimum}`);
    }
    summary.push(`${category} ${Math.round(score * 100)}`);
  }

  console.log(`${path}: ${summary.join(", ")}`);
}
