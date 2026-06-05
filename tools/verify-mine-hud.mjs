#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(".");
const metadataPath = join(rootDir, "docs", "extraction", "mine-hud-metadata.json");
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

assert(metadata.source?.routine === "KIT.BIN:$C197", "HUD source routine must be KIT.BIN:$C197");
assert(metadata.source?.renderer === "KIT.BIN:$C2D4", "HUD renderer must be KIT.BIN:$C2D4");
assert(Array.isArray(metadata.panels), "metadata.panels must be an array");
assert(metadata.panels.length === 2, "expected exactly two HUD panels");

const expectedPanels = new Map([
  ["left-wood-sign", { screenAddress: "0x5900", screenX: 0, screenY: 160 }],
  ["right-gallery-sign", { screenAddress: "0x5920", screenX: 256, screenY: 160 }]
]);

for (const panel of metadata.panels) {
  const expected = expectedPanels.get(panel.id);
  assert(expected, `unexpected panel id ${panel.id}`);
  assert(panel.status === "confirmed", `${panel.id} must be confirmed`);
  assert(panel.width === 64 && panel.height === 40, `${panel.id} must be 64x40`);
  assert(panel.screenAddress === expected.screenAddress, `${panel.id} screen address mismatch`);
  assert(panel.screenX === expected.screenX && panel.screenY === expected.screenY, `${panel.id} screen position mismatch`);
  assert(panel.shapeIndexBytes?.length === 40, `${panel.id} shape index table must contain 40 bytes`);
  assert(panel.colorIndexBytes?.length === 40, `${panel.id} color index table must contain 40 bytes`);
  assert(panel.rgbaSha256?.length === 64, `${panel.id} must expose a PNG RGBA hash`);
  assert(existsSync(join(rootDir, "docs", "extraction", panel.path)), `${panel.path} is missing`);
}

assert(existsSync(join(rootDir, "docs", "extraction", metadata.atlas.path)), "HUD atlas is missing");
console.log("HUD extraction checks passed.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
