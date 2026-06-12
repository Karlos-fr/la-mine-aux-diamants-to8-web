#!/usr/bin/env node
import { createServer } from "vite";

const SAMPLE_SEEDS = [
  "phase12-alpha",
  "phase12-rooms",
  "phase12-maze",
  "phase12-dense",
  "phase12-vertical",
  "phase12-arena",
  "phase12-spiral",
  "phase12-fortress"
];

const SIZE_CASES = [
  { seed: "phase12-small", width: 24, height: 16 },
  { seed: "phase12-original-ish", width: 40, height: 22 },
  { seed: "phase12-wide", width: 64, height: 24 },
  { seed: "phase12-tall", width: 32, height: 36 }
];

const DIFFICULTIES = ["easy", "normal", "hard", "expert"];
const MAX_ORIGINAL_SIMILARITY = 0.96;

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  const { generateBaseLevel } = await vite.ssrLoadModule("/src/level-generator/level-generator.ts");
  const { getModernLevelSource, loadLevelDefinition } = await vite.ssrLoadModule("/src/game/level-loader.ts");
  const { LevelRuntimeGrid } = await vite.ssrLoadModule("/src/game/runtime-grid.ts");
  const {
    RUNTIME_GRID_FILL_TILE_ID,
    RUNTIME_TILE,
    getRuntimeGridStrideForLevel
  } = await vite.ssrLoadModule("/src/game/runtime-tiles.ts");
  const { validateGeneratedLevel } = await vite.ssrLoadModule("/src/level-generator/level-validator.ts");
  const {
    compareGeneratedLevelWithOriginalReferences,
    dumpModernLevelAscii,
    generateLevelDebugBatch
  } = await vite.ssrLoadModule("/src/level-generator/level-debug-tools.ts");
  const { analyzeModernLevelStructure } = await vite.ssrLoadModule("/src/level-generator/level-structure-analysis.ts");

  verifyAttractLevelLoading(getModernLevelSource, loadLevelDefinition);
  verifyLargeRuntimeGrid(LevelRuntimeGrid, RUNTIME_TILE, RUNTIME_GRID_FILL_TILE_ID, getRuntimeGridStrideForLevel);
  verifyReproducibility(generateBaseLevel);
  verifySeedsAndFamilies(generateBaseLevel, validateGeneratedLevel, analyzeModernLevelStructure, compareGeneratedLevelWithOriginalReferences);
  verifySizes(generateBaseLevel, validateGeneratedLevel);
  verifyDifficulties(generateBaseLevel, validateGeneratedLevel);
  verifyEditorAndRuntimeShape(generateBaseLevel, validateGeneratedLevel, dumpModernLevelAscii);
  verifyDebugBatch(generateLevelDebugBatch);

  console.log("Level generator verification passed.");
} finally {
  await vite.close();
}

function verifyLargeRuntimeGrid(LevelRuntimeGrid, RUNTIME_TILE, RUNTIME_GRID_FILL_TILE_ID, getRuntimeGridStrideForLevel) {
  const width = 64;
  const height = 8;
  const tiles = Array.from({ length: width * height }, () => RUNTIME_TILE.empty);
  tiles[2 * width + 50] = RUNTIME_TILE.earth;
  const grid = new LevelRuntimeGrid(
    tiles,
    width,
    height,
    getRuntimeGridStrideForLevel(width),
    RUNTIME_GRID_FILL_TILE_ID
  );

  if (grid.stride < width) {
    throw new Error(`Runtime grid stride ${grid.stride} is smaller than level width ${width}.`);
  }
  if (grid.getTile(50, 2) !== RUNTIME_TILE.earth) {
    throw new Error("Runtime grid treats in-bounds cells beyond the original TO8 width as border.");
  }
  if (grid.getTile(width, 2) !== RUNTIME_GRID_FILL_TILE_ID) {
    throw new Error("Runtime grid does not return the fill tile outside the useful level width.");
  }
}

function verifyAttractLevelLoading(getModernLevelSource, loadLevelDefinition) {
  const attractSource = getModernLevelSource(18);
  if (!attractSource || attractSource.source?.kind !== "attract") {
    throw new Error("Attract level 18 is not available as an attract source.");
  }

  const attractDefinition = loadLevelDefinition(18);
  if (attractDefinition.id !== attractSource.id) {
    throw new Error(`Attract level definition mismatch: ${attractDefinition.id} !== ${attractSource.id}.`);
  }
}

function verifyReproducibility(generateBaseLevel) {
  const first = normalizeGeneratedLevel(generateBaseLevel({ seed: "phase12-repro", width: 40, height: 22 }));
  const second = normalizeGeneratedLevel(generateBaseLevel({ seed: "phase12-repro", width: 40, height: 22 }));
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("Generator is not reproducible for the same seed/options.");
  }
}

function verifySeedsAndFamilies(generateBaseLevel, validateGeneratedLevel, analyzeModernLevelStructure, compareGeneratedLevelWithOriginalReferences) {
  const families = new Set();
  for (const seed of SAMPLE_SEEDS) {
    const result = generateBaseLevel({ seed, width: 40, height: 22 });
    const validation = validateGeneratedLevel(result.level);
    assertNoValidationErrors(seed, validation);
    const analysis = analyzeModernLevelStructure(result.level);
    const comparison = compareGeneratedLevelWithOriginalReferences(analysis);
    families.add(analysis.primaryFamily);
    if (comparison.similarity > MAX_ORIGINAL_SIMILARITY) {
      throw new Error(`Generated level ${seed} is too close to original ${comparison.originalId}: ${comparison.similarity}.`);
    }
    if (!result.warnings.some((warning) => warning.includes("Intent") || warning.includes("Score"))) {
      throw new Error(`Generated level ${seed} does not expose intent/score debug warnings.`);
    }
  }

  if (families.size < 3) {
    throw new Error(`Expected at least 3 structural families across sample seeds, got ${families.size}: ${[...families].join(", ")}.`);
  }
}

function verifySizes(generateBaseLevel, validateGeneratedLevel) {
  for (const options of SIZE_CASES) {
    const result = generateBaseLevel(options);
    if (result.level.width !== options.width || result.level.height !== options.height) {
      throw new Error(`Unexpected size for ${options.seed}: ${result.level.width}x${result.level.height}.`);
    }
    assertNoValidationErrors(options.seed, validateGeneratedLevel(result.level));
  }
}

function verifyDifficulties(generateBaseLevel, validateGeneratedLevel) {
  for (const difficulty of DIFFICULTIES) {
    const seed = `phase12-${difficulty}`;
    const result = generateBaseLevel({ seed, difficulty, width: 40, height: 22 });
    assertNoValidationErrors(seed, validateGeneratedLevel(result.level));
    if (result.level.requiredDiamonds > result.level.entities.filter((entity) => entity.type === "diamond").length) {
      throw new Error(`Required diamonds exceed placed diamonds for difficulty ${difficulty}.`);
    }
  }
}

function verifyEditorAndRuntimeShape(generateBaseLevel, validateGeneratedLevel, dumpModernLevelAscii) {
  const result = generateBaseLevel({ seed: "phase12-editor-runtime", width: 40, height: 22 });
  const level = result.level;
  const serialized = JSON.parse(JSON.stringify(level));
  assertNoValidationErrors("phase12-editor-runtime", validateGeneratedLevel(serialized));
  assertPointInside(level, level.playerSpawn, "playerSpawn");
  assertPointInside(level, level.exit, "exit");
  if (!Array.isArray(level.tiles) || !Array.isArray(level.entities)) {
    throw new Error("Generated level is not editor-serializable.");
  }
  const ascii = dumpModernLevelAscii(level);
  if (!ascii.includes("S") || !ascii.includes("E")) {
    throw new Error("ASCII dump does not expose spawn and exit markers.");
  }
}

function verifyDebugBatch(generateLevelDebugBatch) {
  const batch = generateLevelDebugBatch(["phase12-batch-1", "phase12-batch-2"], { width: 40, height: 22 });
  if (batch.samples.length !== 2 || !batch.report.includes("nearestOriginal")) {
    throw new Error("Debug batch does not expose expected comparison report.");
  }
}

function normalizeGeneratedLevel(result) {
  return {
    level: result.level,
    metadata: result.metadata,
    warnings: result.warnings
  };
}

function assertNoValidationErrors(label, validation) {
  const errors = validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    throw new Error(`${label} has validation errors: ${errors.map((error) => error.code).join(", ")}.`);
  }
}

function assertPointInside(level, point, label) {
  if (point.x < 0 || point.y < 0 || point.x >= level.width || point.y >= level.height) {
    throw new Error(`${label} is outside the level: ${point.x}/${point.y}.`);
  }
}
