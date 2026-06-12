#!/usr/bin/env node
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  const model = await vite.ssrLoadModule("/src/player-customization/player-customization-model.ts");
  const generator = await vite.ssrLoadModule("/src/player-customization/player-customization-generator.ts");

  verifyColorSanitization(model);
  verifyCustomizationSanitization(model);
  verifyRandomReproducibility(generator);
  verifyRandomColorShape(generator, model);

  console.log("Player customization verification passed.");
} finally {
  await vite.close();
}

function verifyColorSanitization({ sanitizeHexColor }) {
  assertEqual(sanitizeHexColor("#ABCDEF", "#000000"), "#abcdef", "full hex should normalize");
  assertEqual(sanitizeHexColor("f0a", "#000000"), "#ff00aa", "short hex should expand");
  assertEqual(sanitizeHexColor("bad-value", "#123456"), "#123456", "invalid hex should fallback");
}

function verifyCustomizationSanitization({ sanitizePlayerCustomization }) {
  const sanitized = sanitizePlayerCustomization({
    id: "custom",
    label: "Custom",
    colors: {
      hair: "#111111",
      skin: "#222222",
      accessory: "#333333",
      body: "#444444",
      arms: "#555555",
      legs: "#666666",
      feet: "#777777"
    }
  });
  assertEqual(sanitized.colors.hair, "#111111", "hair color should survive sanitization");
  assertEqual(sanitized.colors.feet, "#777777", "feet color should survive sanitization");
}

function verifyRandomReproducibility({ generateRandomPlayerCustomization }) {
  const first = generateRandomPlayerCustomization({ seed: "same-seed", family: "arcade" });
  const second = generateRandomPlayerCustomization({ seed: "same-seed", family: "arcade" });
  assertEqual(JSON.stringify(first.colors), JSON.stringify(second.colors), "same seed should generate same colors");
}

function verifyRandomColorShape({ generateRandomPlayerCustomization }, { PLAYER_BODY_PARTS }) {
  const generated = generateRandomPlayerCustomization({ seed: "shape", family: "contrast" });
  for (const part of PLAYER_BODY_PARTS) {
    if (!/^#[0-9a-f]{6}$/.test(generated.colors[part])) {
      throw new Error(`Generated color for ${part} is invalid: ${generated.colors[part]}`);
    }
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}
