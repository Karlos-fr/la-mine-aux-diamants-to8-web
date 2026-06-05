#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(".");
const metadataPath = join(rootDir, "docs", "extraction", "mine-startup-metadata.json");
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

assert(metadata.generatedBy === "tools/extract-mine-startup.mjs", "unexpected generator");
assert(Array.isArray(metadata.assets) && metadata.assets.length >= 1, "startup assets are missing");
assert(Array.isArray(metadata.screens) && metadata.screens.length >= 1, "startup screens are missing");

const logo = metadata.assets.find((asset) => asset.id === "infogrames-logo-map");
assert(logo, "infogrames logo asset is missing");
assert(logo.status === "confirmed", "infogrames logo must be confirmed");
assert(logo.sourceFile === "INFOGRAM.MAP", "infogrames logo must come from INFOGRAM.MAP");
assert(logo.width === 136 && logo.height === 72, "infogrames logo dimensions changed");
assert(existsSync(join(rootDir, "docs", "extraction", logo.path)), `${logo.path} is missing`);

const firstScreen = metadata.screens.find((screen) => screen.id === "startup-01-infogrames-presents");
assert(firstScreen, "startup-01 screen is missing");
assert(firstScreen.status === "confirmed", "startup-01 must be confirmed");
assert(firstScreen.width === 320 && firstScreen.height === 200, "startup-01 must be 320x200");
assert(firstScreen.layers.some((layer) => layer.id === "infogrames-logo" && layer.x === 88 && layer.y === 24), "startup-01 logo placement is wrong");
assert(firstScreen.layers.some((layer) => layer.text === "PRESENTE"), "startup-01 PRESENTE text is missing");
assert(firstScreen.layers.some((layer) => layer.text === "LA MINE"), "startup-01 title line 1 is missing");
assert(firstScreen.layers.some((layer) => layer.text === "AUX DIAMANTS"), "startup-01 title line 2 is missing");
assert(existsSync(join(rootDir, "docs", "extraction", firstScreen.path)), `${firstScreen.path} is missing`);

console.log("Startup extraction checks passed.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
