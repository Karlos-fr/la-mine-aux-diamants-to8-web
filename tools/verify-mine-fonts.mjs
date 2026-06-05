#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(".");
const metadataPath = join(rootDir, "docs", "extraction", "mine-fonts-metadata.json");

if (!existsSync(metadataPath)) {
  throw new Error(`Missing font metadata file: ${metadataPath}`);
}

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

if (metadata.renderer?.routine !== "KIT.BIN:$C601") {
  throw new Error(`Unexpected font renderer: ${metadata.renderer?.routine}`);
}

const largeFont = metadata.fonts.find((font) => font.id === "hud-large-16");
if (!largeFont || largeFont.status !== "confirmed" || largeFont.baseAddress !== "0xC815") {
  throw new Error("Missing confirmed large HUD font at $C815");
}

const digitFont = metadata.fonts.find((font) => font.id === "hud-digits-7");
if (!digitFont || digitFont.status !== "confirmed" || digitFont.baseAddress !== "0xC965") {
  throw new Error("Missing confirmed 7-row digit font at $C965");
}

for (const font of metadata.fonts) {
  const pngPath = join(rootDir, "docs", "extraction", font.png);
  if (!existsSync(pngPath)) {
    throw new Error(`Missing font atlas PNG: ${pngPath}`);
  }
}

const largeLabels = metadata.strings.find((entry) => entry.id === "large-labels-main");
if (!largeLabels || !largeLabels.decoded.includes("Points") || !largeLabels.decoded.includes("Temps")) {
  throw new Error("Large HUD labels do not decode to Points/Temps");
}

const digitChars = digitFont.glyphs.slice(0, 10).map((glyph) => glyph.char).join("");
if (digitChars !== "0123456789") {
  throw new Error(`Unexpected digit mapping for $C965: ${digitChars}`);
}

console.log(`Font verification OK: ${metadata.fonts.length} font tables, renderer ${metadata.renderer.routine}`);
