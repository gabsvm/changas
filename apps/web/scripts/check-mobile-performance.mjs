import fs from "node:fs";

for (const path of process.argv.slice(2)) {
  const report = JSON.parse(fs.readFileSync(path, "utf8"));
  const score = report.categories?.performance?.score ?? 0;
  if (score < 0.45) {
    throw new Error(`${path} performance score ${score} is below 0.45`);
  }
  console.log(`${path}: performance ${Math.round(score * 100)}`);
}
