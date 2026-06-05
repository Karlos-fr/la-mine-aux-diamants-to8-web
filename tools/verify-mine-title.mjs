#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(".");
const metadataPath = join(rootDir, "docs", "extraction", "mine-title-metadata.json");
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

assert(metadata.generatedBy === "tools/extract-mine-title.mjs", "unexpected generator");
assert(metadata.source?.routine === "ENTET.BIN:$9367", "title source routine must be ENTET.BIN:$9367");
assert(metadata.source?.dataBlocks?.includes("ENT.BIN:$7000-$8C62"), "ENT.BIN data block is missing");
assert(metadata.source?.dataBlocks?.includes("ENTET.BIN:$8C63-$9510"), "ENTET.BIN data block is missing");
assert(Array.isArray(metadata.screens) && metadata.screens.length === 1, "expected one title base screen");

const screen = metadata.screens[0];
assert(screen.id === "startup-02-title-entet-9367", "unexpected title screen id");
assert(screen.status === "confirmed", "title base must be confirmed");
assert(screen.width === 320 && screen.height === 200, "title base must be 320x200");
assert(screen.rgbaSha256?.length === 64, "title base RGBA hash is missing");
assert(screen.colorPlaneSha256?.length === 64, "title base color-plane hash is missing");
assert(screen.shapePlaneSha256?.length === 64, "title base shape-plane hash is missing");
assert(existsSync(join(rootDir, "docs", "extraction", screen.path)), `${screen.path} is missing`);

assert(Array.isArray(metadata.animations) && metadata.animations.length === 5, "expected five title animation groups");

const animations = new Map(metadata.animations.map((animation) => [animation.id, animation]));
const face = requireAnimation(animations, "title-face", "ENTET.BIN:$8EB6");
const sparkles = requireAnimation(animations, "title-sparkles", "ENTET.BIN:$8DFF");
const feet = requireAnimation(animations, "title-feet", "ENTET.BIN:$8F2D");
const selection = requireAnimation(animations, "title-selection", "ENTET.BIN:$8DDB");
const menu = requireAnimation(animations, "title-menu-blocks", "ENTET.BIN:$911B/$912E/$9141");

assert(face.frames.length === 17, "title face animation must expose the full $8EF0 blink sequence");
assert(new Set(face.frames.map((frame) => frame.rgbaSha256)).size === 3, "title face animation must contain the three visual states from $8EF0");
assert(sparkles.frames.length === 10, "title sparkle animation must expose all $8E46/$8E5C items");
assert(new Set(sparkles.frames.map((frame) => frame.rgbaSha256)).size === 10, "title sparkle frames must evolve visually");
assert(feet.frames.length === 2, "title feet animation must expose two frames");
assert(new Set(feet.frames.map((frame) => frame.rgbaSha256)).size === 2, "title feet frames must be visually distinct");
assert(selection.frames.length === 3, "title selection state animation must expose states 0,1,2");
assert(new Set(selection.frames.map((frame) => frame.rgbaSha256)).size >= 1, "title selection variants must be captured");
assert(menu.frames.length === 3, "title menu block animation must expose three text variants");
assert(new Set(menu.frames.map((frame) => frame.rgbaSha256)).size >= 1, "title menu variants should be captured");

for (const animation of [face, sparkles, feet, selection, menu]) {
  assert(animation.status === "confirmed", `${animation.id} must be confirmed`);
  for (const frame of animation.frames) {
    assert(frame.rgbaSha256?.length === 64, `${frame.id} RGBA hash is missing`);
    assert(existsSync(join(rootDir, "docs", "extraction", frame.path)), `${frame.path} is missing`);
  }
}

console.log("Title extraction checks passed.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireAnimation(animations, id, routine) {
  const animation = animations.get(id);
  assert(animation, `${id} animation metadata is missing`);
  assert(animation.routine === routine, `${id} must come from ${routine}`);
  assert(Array.isArray(animation.frames), `${id} frames are missing`);
  return animation;
}
