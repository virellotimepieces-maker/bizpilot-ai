import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".git", ".next", "artifacts"]);
const LEGACY = ["Re", "plyPilot"].join("");
const FORBIDDEN = new RegExp(
  `${LEGACY}|${LEGACY.toLowerCase()}|${["Re", "ply Pilot"].join("")}`,
  "i",
);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const hits = [];
for (const file of walk(ROOT)) {
  if (file.endsWith(".webp") || file.endsWith(".ico") || file.endsWith(".png")) continue;
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  for (const [index, line] of text.split("\n").entries()) {
    if (FORBIDDEN.test(line)) hits.push(`${rel}:${index + 1}: ${line.trim()}`);
  }
}

if (hits.length) {
  console.error("Legacy brand references remain:\n" + hits.join("\n"));
  process.exit(1);
}

console.log("Brand check passed: no legacy product name in the repo.");
