#!/usr/bin/env node
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORTAGE_DIR =
  "C:\\a\\Projets\\to8-porting-kit-v2\\build\\portage\\minediamant-fbi-androides-saphir_to8-mine";

const ATLAS_START = 0xd218;
const ATLAS_END = 0xd8d7;
const TILE_SIZE_BYTES = 0x40;
const TILE_WIDTH = 16;
const TILE_HEIGHT = 16;
const SHEET_COLUMNS = 9;
const SHEET_SCALE = 1;
const SHEET_LABEL_HEIGHT = 10;
const SHEET_GAP = 4;
const CONFIRMED_ROCK_RGBA_SHA256 =
  "42d9069123a72a99809133f6d1b977da8c5421200e32b10a83a3ed0a5803d218";

const TO8_INTENSITIES = [
  0, 100, 127, 147, 163, 179, 191, 203,
  215, 223, 231, 239, 243, 247, 251, 255
];

const TO8_DEFAULT_RGB4 = [
  [0x0, 0x0, 0x0],
  [0xf, 0x0, 0x0],
  [0x0, 0xf, 0x0],
  [0xf, 0xf, 0x0],
  [0x0, 0x0, 0xf],
  [0xf, 0x0, 0xf],
  [0x0, 0xf, 0xf],
  [0xf, 0xf, 0xf],
  [0x7, 0x7, 0x7],
  [0xa, 0x3, 0x3],
  [0x3, 0xa, 0x3],
  [0xa, 0xa, 0x3],
  [0x3, 0x3, 0xa],
  [0xa, 0x3, 0xa],
  [0x7, 0xe, 0xe],
  [0xb, 0x3, 0x0]
];

const PALETTE = TO8_DEFAULT_RGB4.map(([red, green, blue]) => [
  TO8_INTENSITIES[red],
  TO8_INTENSITIES[green],
  TO8_INTENSITIES[blue],
  255
]);

const GLYPHS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "A": ["111", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["111", "100", "100", "100", "111"],
  "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"],
  "F": ["111", "100", "110", "100", "100"],
  "x": ["000", "101", "010", "101", "000"]
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(".");
  const portageDir = resolveSourceDir(args.portageDir ?? process.env.MINE_PORTAGE_DIR, rootDir);
  const memoryPath = firstExisting([
    args.memoryPath,
    join(rootDir, "extraction", "sources", "runtime", "memory.bin"),
    join(portageDir, "memory", "memory.bin")
  ]);
  const kitPath = firstExisting([
    args.kitPath,
    join(rootDir, "extraction", "sources", "disk", "kit_bin.bin"),
    join(portageDir, "disk", "files", "kit_bin.bin")
  ]);
  const kitBlocksDir = firstExisting([
    args.kitBlocksDir,
    join(portageDir, "memory", "blocks")
  ]);
  const outDir = resolve(args.outDir ?? join(rootDir, "docs", "extraction"));
  const generatedDir = resolve(args.generatedDir ?? join(rootDir, "src", "assets", "generated"));

  mkdirSync(outDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  const memory = readFileSync(memoryPath);
  const atlasMemory = Buffer.from(memory);
  overlayKitBlocks(atlasMemory, kitBlocksDir);
  const kit = readFileSync(kitPath);
  const tileCount = Math.floor((ATLAS_END - ATLAS_START + 1) / TILE_SIZE_BYTES);
  const tiles = [];
  const tileImages = [];

  for (let tileId = 0; tileId < tileCount; tileId += 1) {
    const address = ATLAS_START + tileId * TILE_SIZE_BYTES;
    const bytes = atlasMemory.subarray(address, address + TILE_SIZE_BYTES);
    const rgba = renderTileRgba(bytes);
    const name = tileId === 0 ? "rock" : null;
    const status = tileId === 0 ? "confirmed" : "unidentified";
    const fileName = `mine-tile-${hex(tileId, 2)}${name ? `-${name}` : ""}.png`;

    writeFileSync(join(outDir, fileName), encodePng(TILE_WIDTH, TILE_HEIGHT, rgba));
    tileImages.push({ tileId, rgba });
    tiles.push({
      tileId,
      hexId: `0x${hex(tileId, 2)}`,
      name,
      status,
      address: `0x${hex(address, 4)}`,
      endAddress: `0x${hex(address + TILE_SIZE_BYTES - 1, 4)}`,
      sizeBytes: TILE_SIZE_BYTES,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      memoryOffset: `0x${hex(address, 4)}`,
      kitOffsets: findAllOffsets(kit, bytes).map((offset) => `0x${hex(offset, 4)}`),
      rgbaSha256: sha256(rgba),
      byteSha256: sha256(bytes),
      format: {
        shapePlane: "bytes 0..31",
        colorPlane: "bytes 32..63",
        rendererFormula: "$D218 + tileId * $40"
      }
    });
  }

  const atlas = buildAtlas(tileImages);
  writeFileSync(join(outDir, "mine-tiles-atlas-D218-D8D7.png"), encodePng(atlas.width, atlas.height, atlas.rgba));

  const sheet = buildControlSheet(tileImages);
  writeFileSync(
    join(outDir, "mine-tiles-D218-D8D7-control.png"),
    encodePng(sheet.width, sheet.height, sheet.rgba)
  );

  const rockTile = tiles[0];
  writeFileSync(join(outDir, "rock-bin-tile00.png"), encodePng(TILE_WIDTH, TILE_HEIGHT, tileImages[0].rgba));

  const metadata = {
    generatedBy: basename(import.meta.url),
    source: {
      portageDir,
      memoryPath,
      kitPath,
      excludedDiskFamilies: ["SAPHIR.*", "FBI.*", "ANDROIDE.*"]
    },
    atlas: {
      startAddress: `0x${hex(ATLAS_START, 4)}`,
      endAddress: `0x${hex(ATLAS_END, 4)}`,
      tileCount,
      tileSizeBytes: TILE_SIZE_BYTES,
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
      shapePlaneBytes: 32,
      colorPlaneBytes: 32,
      rendererRoutine: "KIT.BIN:$D145",
      rendererFormula: "$D218 + tileId * $40",
      png: "mine-tiles-atlas-D218-D8D7.png",
      controlPng: "mine-tiles-D218-D8D7-control.png"
    },
    confirmedAssets: {
      rock: {
        tileId: 0,
        address: "0xD218",
        png: "rock-bin-tile00.png",
        rgbaSha256: rockTile.rgbaSha256,
        expectedRgbaSha256: CONFIRMED_ROCK_RGBA_SHA256
      }
    },
    tiles
  };

  writeFileSync(join(outDir, "mine-tiles-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  writeFileSync(join(generatedDir, "mine-tiles.ts"), renderTypeScriptMetadata(metadata));
  writeNamedSpriteAssets(outDir, generatedDir, tileImages, tiles, atlasMemory);

  console.log(`Extracted ${tileCount} tiles from ${memoryPath}`);
  console.log(`Wrote ${join(outDir, "mine-tiles-atlas-D218-D8D7.png")}`);
  console.log(`Rock rgba sha256: ${rockTile.rgbaSha256}`);
}

function writeNamedSpriteAssets(outDir, generatedDir, tileImages, tiles, memory) {
  const idleCycle = Array.from(memory.subarray(0xd036, 0xd06a));
  const uniqueIdleFrames = [...new Set(idleCycle)];
  const diamondColorCycle = buildDiamondColorCycle(memory);
  const monsterBlinkCycle = buildMonsterBlinkCycle(memory);
  const groups = [
    {
      id: "player",
      status: "confirmed",
      frames: [
        { name: "idle_07", tileId: 0x07, status: "confirmed" },
        { name: "idle_08", tileId: 0x08, status: "confirmed" },
        { name: "idle_09", tileId: 0x09, status: "confirmed" },
        { name: "idle_0a", tileId: 0x0a, status: "confirmed" },
        { name: "idle_0b", tileId: 0x0b, status: "confirmed" },
        { name: "move_right_step_0", tileId: 0x0c, status: "confirmed" },
        { name: "move_right_step_1", tileId: 0x0d, status: "confirmed" },
        { name: "move_right_step_2", tileId: 0x0e, status: "confirmed" },
        { name: "move_left_step_0", tileId: 0x0f, status: "confirmed" },
        { name: "move_left_step_1", tileId: 0x10, status: "confirmed" },
        { name: "move_left_step_2", tileId: 0x11, status: "confirmed" }
      ],
      animations: [
        {
          id: "idleCycle",
          status: "confirmed",
          frameTileIds: idleCycle,
          uniqueFrameTileIds: uniqueIdleFrames,
          sourceAddress: "0xD036-0xD069",
          evidence: ["KIT.BIN:$CED9 cycles bytes from $D036-$D069 and writes them at $D034 player pointer"]
        },
        {
          id: "moveRight",
          status: "confirmed",
          frameTileIds: [0x0c, 0x0d, 0x0e],
          frameNames: ["move_right_step_0", "move_right_step_1", "move_right_step_2"],
          evidence: [
            "KIT.BIN:$CEF0 stores tileId 0x0C before moving right",
            "KIT.BIN:$CEF5 applies COM $D02F, enabling the walk phase",
            "KIT.BIN:$CEC0-$CED5 increments the current player tile until 0x0E, then toggles $D02F"
          ]
        },
        {
          id: "moveLeft",
          status: "confirmed",
          frameTileIds: [0x0f, 0x10, 0x11],
          frameNames: ["move_left_step_0", "move_left_step_1", "move_left_step_2"],
          evidence: [
            "KIT.BIN:$CF4A stores tileId 0x0F before moving left",
            "KIT.BIN:$CF4F applies COM $D02F, enabling the walk phase",
            "KIT.BIN:$CEC0-$CED5 increments the current player tile until 0x11, then toggles $D02F"
          ]
        },
        {
          id: "moveVertical",
          status: "confirmed_alias",
          frameTileIds: [],
          usesLastHorizontalFrame: true,
          evidence: [
            "KIT.BIN:$CFA8 and KIT.BIN:$CFEA do not store a vertical tileId",
            "KIT.BIN:$CFAE/$CFF0 apply COM $D02F and KIT.BIN:$CFBF/$D001 reload $D02E, reusing the last horizontal direction",
            "the shared KIT.BIN:$CEC0-$CED5 phase code then advances through the right or left walk frames"
          ]
        },
        {
          id: "exitBlock",
          status: "confirmed_non_sprite",
          frameTileIds: [0x04],
          evidence: ["KIT.BIN:$BFB6 writes 0x04 at the exit pointer $DBB3, so tile 0x04 is not grouped as a character sprite"]
        }
      ],
      evidence: [
        "KIT.BIN:$CED9 cycles the player idle table $D036-$D069",
        "KIT.BIN:$CEF0 writes 0x0C while moving right, $CEF5 toggles $D02F, then $CEC0-$CED5 advances 0x0C->0x0D->0x0E",
        "KIT.BIN:$CF4A writes 0x0F while moving left, $CF4F toggles $D02F, then $CEC0-$CED5 advances 0x0F->0x10->0x11",
        "KIT.BIN:$CFA8/$CFEA reuse $D02E for vertical movement and rely on the same $D02F phase advance",
        "KIT.BIN:$BFB6 writes 0x04 as the exit/protected block marker, not a confirmed character frame"
      ]
    },
    {
      id: "diamond",
      status: "confirmed",
      frames: [
        { name: "color_cycle_0", tileId: 0x03, status: "confirmed" },
        { name: "color_cycle_1", tileId: 0x03, status: "confirmed", rgbaOverride: diamondColorCycle[1] },
        { name: "color_cycle_2", tileId: 0x03, status: "confirmed", rgbaOverride: diamondColorCycle[2] },
        { name: "color_cycle_3", tileId: 0x03, status: "confirmed", rgbaOverride: diamondColorCycle[3] },
        { name: "color_cycle_4", tileId: 0x03, status: "confirmed", rgbaOverride: diamondColorCycle[4] },
        { name: "color_cycle_5", tileId: 0x03, status: "confirmed", rgbaOverride: diamondColorCycle[5] },
        { name: "color_cycle_6", tileId: 0x03, status: "confirmed", rgbaOverride: diamondColorCycle[6] },
        { name: "color_cycle_7", tileId: 0x03, status: "confirmed", rgbaOverride: diamondColorCycle[7] },
        { name: "sliding_left_state", tileId: 0x13, status: "confirmed" }
      ],
      animations: [
        {
          id: "colorCycle",
          status: "confirmed",
          frameTileIds: [0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03],
          frameCount: 8,
          evidence: [
            "KIT.BIN:$D1E0 rotates the color plane bytes $D2F8-$D317 of tileId 0x03",
            "the rotation moves the color attributes upward by two rows per call"
          ]
        },
        {
          id: "fallingOrSliding",
          status: "confirmed",
          frameTileIds: [0x03, 0x13],
          evidence: [
            "KIT.BIN:$CB17 treats 0x03 as falling object",
            "KIT.BIN:$CB84/$CBE2 generate 0x13 from diamond state"
          ]
        }
      ],
      evidence: [
        "tileId 0x03 confirmed as diamond in phase 3",
        "tileId 0x13 is generated by falling-object routines from diamond state",
        "KIT.BIN:$D1E0 animates diamond colors by rotating tile 0x03 color plane"
      ]
    },
    {
      id: "rocks",
      status: "confirmed",
      frames: [
        { name: "static", tileId: 0x00, status: "confirmed" },
        { name: "sliding_left_state", tileId: 0x12, status: "confirmed" }
      ],
      animations: [
        {
          id: "fallingOrSliding",
          status: "confirmed",
          frameTileIds: [0x00, 0x12],
          evidence: [
            "KIT.BIN:$CB17 treats 0x00 as falling object",
            "KIT.BIN:$CB89/$CBDD generate 0x12 from rock state"
          ]
        }
      ],
      evidence: [
        "tileId 0x00 confirmed as rock in phase 1",
        "tileId 0x12 shares rock visual asset and is generated by falling-object routines"
      ]
    },
    {
      id: "explosion",
      status: "confirmed",
      frames: [
        { name: "blast_1", tileId: 0x14, status: "confirmed" },
        { name: "blast_2", tileId: 0x15, status: "confirmed" },
        { name: "blast_3", tileId: 0x16, status: "confirmed" },
        { name: "empty_after_blast", tileId: 0x05, status: "confirmed" }
      ],
      animations: [
        {
          id: "blast3x3",
          status: "confirmed",
          frameTileIds: [0x14, 0x15, 0x16, 0x05],
          evidence: [
            "KIT.BIN:$CCC6 writes 0x14 then 0x15 then 0x16 then 0x05 around the target cell",
            "KIT.BIN:$CCFE applies each frame to the 3x3 neighborhood unless a cell contains 0x04"
          ]
        }
      ],
      evidence: [
        "KIT.BIN:$CCC6 is the 3x3 explosion sequence",
        "KIT.BIN:$CD4E refreshes rendering after each explosion frame through $D1BB/$D1E0/$D06B"
      ]
    },
    {
      id: "objects",
      status: "mixed",
      frames: [
        { name: "earth", tileId: 0x01, status: "suspected" },
        { name: "monster", tileId: 0x02, status: "confirmed" },
        { name: "exit_block", tileId: 0x04, status: "confirmed" },
        { name: "empty", tileId: 0x05, status: "confirmed" },
        { name: "platform", tileId: 0x06, status: "suspected" },
        { name: "special_target", tileId: 0x17, status: "confirmed" },
        { name: "unknown_18", tileId: 0x18, status: "unidentified" },
        { name: "unknown_19", tileId: 0x19, status: "unidentified" },
        { name: "unknown_1a", tileId: 0x1a, status: "unidentified" }
      ],
      animations: [
        {
          id: "monsterBlink",
          status: "confirmed",
          frameTileIds: [0x02, 0x02],
          evidence: [
            "KIT.BIN:$D1BB complements the shape plane bytes $D298-$D2B7 of tileId 0x02",
            "KIT.BIN:$CC5B tests tileId 0x02 against the special-position table at $DAF4",
            "KIT.BIN:$D1BB is called from the active loop at $BEC7 and $BF68"
          ]
        }
      ],
      evidence: [
        "static and special tiles grouped separately from player/diamond/rocks",
        "tile 0x02 is animated by KIT.BIN:$D1BB and checked against $DAF4 by KIT.BIN:$CC5B-$CC88",
        "tile 0x18 remains unconfirmed and is not treated as the monster",
        "KIT.BIN:$D1BB also swaps the shape planes $D7D8-$D7F7 and $D858-$D877 for tileIds 0x17 and 0x1A",
        "unidentified tiles remain explicitly unconfirmed"
      ]
    }
  ];

  groups.push({
    id: "monster",
    status: "confirmed",
    frames: monsterBlinkCycle.map((frame, index) => ({
      name: frame.name,
      tileId: frame.tileId,
      status: "confirmed",
      rgbaOverride: frame.rgba
    })),
    animations: [
      {
        id: "blinkToggle",
        status: "confirmed",
        frameTileIds: monsterBlinkCycle.map((frame) => frame.tileId),
        evidence: [
          "KIT.BIN:$D1BB toggles tile 0x02 by complementing its 32-byte shape plane"
        ]
      }
    ],
    evidence: [
      "animation reconstructed by applying KIT.BIN:$D1BB effects to tileId 0x02 atlas bytes",
      "the two frames match the red/blue square alternation seen in the running port"
    ]
  });

  const spriteDir = join(outDir, "sprites");
  mkdirSync(spriteDir, { recursive: true });

  for (const group of groups) {
    const frameImages = group.frames.map((frame) => ({
      tileId: frame.tileId,
      rgba: frame.rgbaOverride ?? tileImages[frame.tileId].rgba
    }));
    const atlas = buildFrameAtlas(frameImages);
    const atlasFileName = `${group.id}-atlas.png`;
    const controlFileName = `${group.id}-control.png`;
    writeFileSync(join(spriteDir, atlasFileName), encodePng(atlas.width, atlas.height, atlas.rgba));
    const control = buildFrameControlSheet(group.frames, frameImages);
    writeFileSync(join(spriteDir, controlFileName), encodePng(control.width, control.height, control.rgba));
    group.atlas = `sprites/${atlasFileName}`;
    group.controlPng = `sprites/${controlFileName}`;
    group.frames = group.frames.map((frame, index) => ({
      ...frame,
      rgbaOverride: undefined,
      hexId: `0x${hex(frame.tileId, 2)}`,
      sourceAddress: tiles[frame.tileId]?.address,
      atlasX: index * TILE_WIDTH,
      atlasY: 0,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      rgbaSha256: sha256(frame.rgbaOverride ?? tileImages[frame.tileId].rgba)
    }));
  }

  const spriteMetadata = {
    generatedBy: "extract-mine-assets.mjs",
    sourceAtlas: {
      startAddress: `0x${hex(ATLAS_START, 4)}`,
      endAddress: `0x${hex(ATLAS_END, 4)}`,
      rendererRoutine: "KIT.BIN:$D145"
    },
    groups
  };

  writeFileSync(join(outDir, "mine-sprites-metadata.json"), `${JSON.stringify(spriteMetadata, null, 2)}\n`);
  writeFileSync(
    join(generatedDir, "mine-sprites.ts"),
    `/**\n` +
      ` * Generated by tools/extract-mine-assets.mjs.\n` +
      ` * Source metadata is embedded in mineSpriteMetadata below.\n` +
      ` * Do not edit by hand.\n` +
      ` */\n` +
      `export const mineSpriteMetadata = ${JSON.stringify(spriteMetadata, null, 2)} as const;\n` +
      `export type MineSpriteMetadata = typeof mineSpriteMetadata;\n`
  );
}

function buildDiamondColorCycle(memory) {
  const tileBytes = Buffer.from(memory.subarray(ATLAS_START + 0x03 * TILE_SIZE_BYTES, ATLAS_START + 0x04 * TILE_SIZE_BYTES));
  const frames = [];
  for (let frame = 0; frame < 8; frame += 1) {
    frames.push(renderTileRgba(tileBytes));
    rotateDiamondColorPlane(tileBytes);
  }
  return frames;
}

function buildMonsterBlinkCycle(memory) {
  const before02 = Buffer.from(memory.subarray(ATLAS_START + 0x02 * TILE_SIZE_BYTES, ATLAS_START + 0x03 * TILE_SIZE_BYTES));
  const after02 = Buffer.from(before02);
  for (let offset = 0; offset < 32; offset += 1) {
    after02[offset] = (~after02[offset]) & 0xff;
  }
  return [
    { name: "blink_0", tileId: 0x02, rgba: renderTileRgba(before02) },
    { name: "blink_1", tileId: 0x02, rgba: renderTileRgba(after02) }
  ];
}

function rotateDiamondColorPlane(tileBytes) {
  const colorPlaneStart = 32;
  const saved = Buffer.from(tileBytes.subarray(colorPlaneStart, colorPlaneStart + 4));
  for (let offset = colorPlaneStart; offset < colorPlaneStart + 28; offset += 4) {
    tileBytes.copy(tileBytes, offset, offset + 4, offset + 8);
  }
  saved.copy(tileBytes, colorPlaneStart + 28);
}

function buildFrameAtlas(frameImages) {
  const width = frameImages.length * TILE_WIDTH;
  const height = TILE_HEIGHT;
  const rgba = Buffer.alloc(width * height * 4);
  fill(rgba, [0, 0, 0, 0]);
  frameImages.forEach((frame, index) => {
    blit(rgba, width, frame.rgba, TILE_WIDTH, TILE_HEIGHT, index * TILE_WIDTH, 0);
  });
  return { width, height, rgba };
}

function buildFrameControlSheet(frames, frameImages) {
  const scale = 1;
  const labelHeight = 12;
  const cellWidth = TILE_WIDTH * scale;
  const cellHeight = TILE_HEIGHT * scale + labelHeight;
  const width = frames.length * cellWidth + Math.max(0, frames.length - 1) * SHEET_GAP;
  const height = cellHeight;
  const rgba = Buffer.alloc(width * height * 4);
  fill(rgba, [32, 32, 32, 255]);
  frameImages.forEach((frame, index) => {
    const x = index * (cellWidth + SHEET_GAP);
    const scaled = scaleRgba(TILE_WIDTH, TILE_HEIGHT, frame.rgba, scale);
    blit(rgba, width, scaled, cellWidth, TILE_HEIGHT * scale, x, 0);
    drawText(rgba, width, x + 2, TILE_HEIGHT * scale + 2, `0x${hex(frames[index].tileId, 2)}`);
  });
  return { width, height, rgba };
}

export function renderTileRgba(tileBytes) {
  if (tileBytes.length !== TILE_SIZE_BYTES) {
    throw new Error(`Expected ${TILE_SIZE_BYTES} tile bytes, got ${tileBytes.length}`);
  }
  const rgba = Buffer.alloc(TILE_WIDTH * TILE_HEIGHT * 4);
  for (let y = 0; y < TILE_HEIGHT; y += 1) {
    for (let byteIndex = 0; byteIndex < 2; byteIndex += 1) {
      const shapeByte = tileBytes[y * 2 + byteIndex];
      const colorByte = tileBytes[32 + y * 2 + byteIndex];
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byteIndex * 8 + bit;
        const shape = (shapeByte & (0x80 >> bit)) !== 0;
        const colorIndex = colorIndexFromAttribute(colorByte, shape);
        writePixel(rgba, TILE_WIDTH, x, y, PALETTE[colorIndex]);
      }
    }
  }
  return rgba;
}

export function encodePng(width, height, rgba) {
  const rowLength = width * 4;
  const raw = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowLength + 1)] = 0;
    rgba.copy(raw, y * (rowLength + 1) + 1, y * rowLength, (y + 1) * rowLength);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function buildAtlas(tileImages) {
  const width = tileImages.length * TILE_WIDTH;
  const height = TILE_HEIGHT;
  const rgba = Buffer.alloc(width * height * 4);
  fill(rgba, [0, 0, 0, 0]);
  for (const tile of tileImages) {
    blit(rgba, width, tile.rgba, TILE_WIDTH, TILE_HEIGHT, tile.tileId * TILE_WIDTH, 0);
  }
  return { width, height, rgba };
}

function buildControlSheet(tileImages) {
  const rows = Math.ceil(tileImages.length / SHEET_COLUMNS);
  const cellWidth = TILE_WIDTH * SHEET_SCALE;
  const cellHeight = TILE_HEIGHT * SHEET_SCALE + SHEET_LABEL_HEIGHT;
  const width = SHEET_COLUMNS * cellWidth + (SHEET_COLUMNS - 1) * SHEET_GAP;
  const height = rows * cellHeight + (rows - 1) * SHEET_GAP;
  const rgba = Buffer.alloc(width * height * 4);
  fill(rgba, [32, 32, 32, 255]);

  for (const tile of tileImages) {
    const col = tile.tileId % SHEET_COLUMNS;
    const row = Math.floor(tile.tileId / SHEET_COLUMNS);
    const x = col * (cellWidth + SHEET_GAP);
    const y = row * (cellHeight + SHEET_GAP);
    const scaled = scaleRgba(TILE_WIDTH, TILE_HEIGHT, tile.rgba, SHEET_SCALE);
    blit(rgba, width, scaled, cellWidth, TILE_HEIGHT * SHEET_SCALE, x, y);
    drawText(rgba, width, x + 2, y + TILE_HEIGHT * SHEET_SCALE + 2, `0x${hex(tile.tileId, 2)}`);
  }

  return { width, height, rgba };
}

function colorIndexFromAttribute(attribute, shape) {
  const background = ((attribute & 0x07) | ((~attribute & 0x80) >> 4)) & 0x0f;
  const foreground = (((attribute >> 3) & 0x07) | ((~attribute & 0x40) >> 3)) & 0x0f;
  return shape ? foreground : background;
}

function renderTypeScriptMetadata(metadata) {
  return `/**\n` +
    ` * Generated by tools/extract-mine-assets.mjs.\n` +
    ` * Source metadata is embedded in mineTileMetadata below.\n` +
    ` * Do not edit by hand.\n` +
    ` */\n` +
    `export const mineTileMetadata = ${JSON.stringify(metadata, null, 2)} as const;\n` +
    `export type MineTileMetadata = typeof mineTileMetadata;\n`;
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--portage-dir") parsed.portageDir = args[++i];
    else if (arg === "--memory") parsed.memoryPath = args[++i];
    else if (arg === "--kit") parsed.kitPath = args[++i];
    else if (arg === "--kit-blocks-dir") parsed.kitBlocksDir = args[++i];
    else if (arg === "--out-dir") parsed.outDir = args[++i];
    else if (arg === "--generated-dir") parsed.generatedDir = args[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function overlayKitBlocks(memory, blocksDir) {
  if (!blocksDir || !existsSync(blocksDir)) return;
  for (const fileName of readdirSync(blocksDir)) {
    if (!fileName.startsWith("load-004-KIT.BIN-block-")) continue;
    const match = fileName.match(/\$([0-9A-F]{4})-\$([0-9A-F]{4})\.bin$/i);
    if (!match) continue;
    const start = Number.parseInt(match[1], 16);
    const end = Number.parseInt(match[2], 16);
    if (end < ATLAS_START || start > ATLAS_END) continue;
    const bytes = readFileSync(join(blocksDir, fileName));
    bytes.copy(memory, start);
  }
}

function resolveSourceDir(candidate, rootDir) {
  if (candidate && existsSync(candidate)) return candidate;
  if (existsSync(DEFAULT_PORTAGE_DIR)) return DEFAULT_PORTAGE_DIR;
  return rootDir;
}

function firstExisting(paths) {
  for (const path of paths) {
    if (path && existsSync(path)) return path;
  }
  throw new Error(`Missing source file. Tried: ${paths.filter(Boolean).join(", ")}`);
}

function findAllOffsets(source, pattern) {
  const offsets = [];
  for (let offset = 0; offset <= source.length - pattern.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < pattern.length; index += 1) {
      if (source[offset + index] !== pattern[index]) {
        matches = false;
        break;
      }
    }
    if (matches) offsets.push(offset);
  }
  return offsets;
}

function scaleRgba(width, height, rgba, scale) {
  const out = Buffer.alloc(width * scale * height * scale * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = readPixel(rgba, width, x, y);
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          writePixel(out, width * scale, x * scale + sx, y * scale + sy, color);
        }
      }
    }
  }
  return out;
}

function blit(target, targetWidth, source, sourceWidth, sourceHeight, dx, dy) {
  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      writePixel(target, targetWidth, dx + x, dy + y, readPixel(source, sourceWidth, x, y));
    }
  }
}

function drawText(rgba, width, x, y, text) {
  let cursor = x;
  for (const char of text) {
    drawGlyph(rgba, width, cursor, y, char);
    cursor += 4;
  }
}

function drawGlyph(rgba, width, x, y, char) {
  const glyph = GLYPHS[char] ?? GLYPHS["0"];
  for (let gy = 0; gy < glyph.length; gy += 1) {
    for (let gx = 0; gx < glyph[gy].length; gx += 1) {
      if (glyph[gy][gx] === "1") {
        writePixel(rgba, width, x + gx, y + gy, [255, 255, 255, 255]);
      }
    }
  }
}

function fill(rgba, color) {
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = color[3];
  }
}

function readPixel(rgba, width, x, y) {
  const offset = (y * width + x) * 4;
  return [rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3]];
}

function writePixel(rgba, width, x, y, color) {
  const offset = (y * width + x) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hex(value, length) {
  return value.toString(16).toUpperCase().padStart(length, "0");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
