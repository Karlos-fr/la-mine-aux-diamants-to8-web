#!/usr/bin/env node
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const DEFAULT_PORTAGE_DIR =
  "C:\\a\\Projets\\to8-porting-kit-v2\\build\\portage\\minediamant-fbi-androides-saphir_to8-mine";

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
const SCREEN_STRIDE_BYTES = 40;
const VIDEO_PLANE_BYTES = 8000;

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
const ROUTINE_9367_PATH = "routines/9367_routine_entet_9367.ts";
const ROUTINE_8DDB_PATH = "routines/8DDB_routine_entet_8ddb.ts";
const ROUTINE_911B_PATH = "routines/911B_routine_entet_911b.ts";
const ROUTINE_8E85_PATH = "routines/8E85_routine_entet_8e85.ts";
const ROUTINE_8F05_PATH = "routines/8F05_routine_entet_8f05.ts";
const ROUTINE_8F20_PATH = "routines/8F20_routine_entet_8f20.ts";

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(".");
  const portageDir = resolveSourceDir(args.portageDir ?? process.env.MINE_PORTAGE_DIR, rootDir);
  const blocksDir = firstExisting([args.blocksDir, join(portageDir, "memory", "blocks")]);
  const routinePath = firstExisting([
    args.routinePath,
    join(portageDir, "web", "src", "ported", ROUTINE_9367_PATH)
  ]);
  const routinePath8DDB = firstExisting([
    join(portageDir, "web", "src", "ported", ROUTINE_8DDB_PATH)
  ]);
  const routinePath911B = firstExisting([
    join(portageDir, "web", "src", "ported", ROUTINE_911B_PATH)
  ]);
  const routinePath8E85 = firstExisting([
    join(portageDir, "web", "src", "ported", ROUTINE_8E85_PATH)
  ]);
  const routinePath8F05 = firstExisting([
    join(portageDir, "web", "src", "ported", ROUTINE_8F05_PATH)
  ]);
  const routinePath8F20 = firstExisting([
    join(portageDir, "web", "src", "ported", ROUTINE_8F20_PATH)
  ]);
  const outDir = resolve(args.outDir ?? join(rootDir, "docs", "extraction", "startup"));
  const generatedDir = resolve(args.generatedDir ?? join(rootDir, "src", "assets", "generated"));

  mkdirSync(outDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  const memory = new Uint8Array(65536);
  for (let index = 0; index < memory.length; index += 1) memory[index] = (index & 0x80) === 0 ? 0 : 0xff;
  overlayBlocks(memory, blocksDir);

  const routineRegistry = loadRoutineRegistry([
    routinePath,
    routinePath8DDB,
    routinePath911B,
    routinePath8E85,
    routinePath8F05,
    routinePath8F20
  ]);

  const base = executeEntetRoutine(memory, routinePath, 0x9367, routineRegistry);
  const video = { color: base.color, shape: base.shape };
  const rgba = renderScreen(video.color, video.shape);
  const screenPath = join(outDir, "startup-02-title-entet-9367.png");
  writeFileSync(screenPath, encodePng(SCREEN_WIDTH, SCREEN_HEIGHT, rgba));
  const animationFrames = extractTitleAnimations(base.memory, video, outDir, routineRegistry);

  const metadata = {
    generatedBy: "tools/extract-mine-title.mjs",
    source: {
      portageDir,
      blocksDir,
      routinePath,
      menuRoutinePath: routinePath8DDB,
      faceRoutinePath: routinePath911B,
      dataBlocks: ["ENT.BIN:$7000-$8C62", "ENTET.BIN:$8C63-$9510"],
      routine: "ENTET.BIN:$9367",
      rendererHelpers: ["ENTET.BIN:$938D", "ENTET.BIN:$93C0", "ENTET.BIN:$9406"],
      animationRoutines: ["ENTET.BIN:$8EB6", "ENTET.BIN:$8DFF", "ENTET.BIN:$8F2D"],
      note: "The generated TypeScript routine is used as a build-time decoder oracle; the produced PNG is reconstructed from video planes, not copied from docs/title.png."
    },
    screens: [
      {
        id: "startup-02-title-entet-9367",
        status: "confirmed",
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        path: "startup/startup-02-title-entet-9367.png",
        rgbaSha256: sha256(rgba),
        colorPlaneSha256: sha256(video.color),
        shapePlaneSha256: sha256(video.shape),
        evidence: [
          "ENTET.BIN:$8C80 calls ENTET.BIN:$9367 during title startup",
          "ENTET.BIN:$9367 loads Y=$7000 and decodes ENT.BIN data into the 320x16 screen planes",
          "ENTET.BIN:$8E9E/$8EAA switch between shape and color video pages"
        ]
      }
    ],
    animations: animationFrames
  };

  const metadataPath = join(outDir, "..", "mine-title-metadata.json");
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  writeFileSync(join(outDir, "..", "mine-title-summary.md"), renderSummary(metadata));
  writeFileSync(join(generatedDir, "mine-title.ts"), renderTypeScript(metadata));

  console.log(`Extracted title screen base to ${screenPath}`);
}

function extractTitleAnimations(memory, baseVideo, outDir, routineRegistry) {
  const animations = [
    extractFaceFrames(memory, baseVideo, outDir),
    extractSparkleFrames(memory, baseVideo, outDir),
    extractFeetFrames(memory, baseVideo, outDir),
    extractSelectionFrames(memory, baseVideo, outDir, routineRegistry),
    extractMenuFrames(memory, baseVideo, outDir, routineRegistry)
  ];
  return animations;
}

function extractSelectionFrames(memory, baseVideo, outDir, routineRegistry) {
  const frames = [];
  const cursorStates = [0, 1, 2];
  for (const [frameNumber, state] of cursorStates.entries()) {
    const runtimeMemory = new Uint8Array(memory);
    runtimeMemory[0x8DDA] = state;
    const routineEntry = getRoutineEntry(routineRegistry, 0x8DDB);
    const video = executeEntetRoutine(runtimeMemory, routineEntry.path, 0x8DDB, routineRegistry);
    const rgba = renderScreen(video.color, video.shape);
    const framePath = `startup/animations/title-selection-${String(frameNumber).padStart(2, "0")}.png`;
    writeAnimationPngs(outDir, framePath, SCREEN_WIDTH, SCREEN_HEIGHT, rgba);
    frames.push({
      id: `title-selection-${String(frameNumber).padStart(2, "0")}`,
      frameNumber,
      state,
      path: framePath,
      rgbaSha256: sha256(rgba)
    });
  }

  return {
    id: "title-selection",
    status: "confirmed",
    routine: "ENTET.BIN:$8DDB",
    stateAddress: "0x8DDA",
    stateTable: "0x9340",
    source: {
      description: "Simule la routine ENTET.BIN:$8DDB pour les 3 états de curseur de menu",
      framesFrom: "0..2"
    },
    frames
  };
}

function extractMenuFrames(memory, baseVideo, outDir, routineRegistry) {
  const variants = [
    { id: "title-menu-911b", routine: 0x911B },
    { id: "title-menu-912e", routine: 0x912E },
    { id: "title-menu-9141", routine: 0x9141 }
  ];
  const frames = [];
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const runtimeMemory = new Uint8Array(memory);
    const routineEntry = getRoutineEntry(routineRegistry, variant.routine);
    const video = executeEntetRoutine(runtimeMemory, routineEntry.path, variant.routine, routineRegistry);
    const rgba = renderScreen(video.color, video.shape);
    const path = `startup/animations/${variant.id}.png`;
    writeAnimationPngs(outDir, path, SCREEN_WIDTH, SCREEN_HEIGHT, rgba);
    frames.push({
      id: variant.id,
      routineAddress: `0x${hex(variant.routine, 4)}`,
      path,
      rgbaSha256: sha256(rgba)
    });
  }

  return {
    id: "title-menu-blocks",
    status: "confirmed",
    routine: "ENTET.BIN:$911B/$912E/$9141",
    source: {
      tableBase: {
        "$911B": "0x91E6 -> 5E09",
        "$912E": "0x91FB -> 5E00",
        "$9141": "0x9223 -> 5E0F"
      },
      renderer: "ENTET.BIN:$9154"
    },
    frames
  };
}

function extractFaceFrames(memory, baseVideo, outDir) {
  const frameIndexes = readTerminatedBytes(memory, 0x8ef0, 0xdd);
  const frames = [];
  for (let frameNumber = 0; frameNumber < frameIndexes.length; frameNumber += 1) {
    const frameIndex = frameIndexes[frameNumber];
    const video = cloneVideo(baseVideo);
    drawDoubleColumnGlyph(video.shape, 0x43d8, memory, 0x905b + frameIndex * 0x10);
    drawDoubleColumnGlyph(video.color, 0x43d8, memory, 0x905b + frameIndex * 0x10 + 8);
    const crop = renderCrop(video.color, video.shape, 192, 24, 24, 8);
    const framePath = `startup/animations/title-face-${String(frameNumber).padStart(2, "0")}.png`;
    writeAnimationPngs(outDir, framePath, 24, 8, crop);
    frames.push({
      id: `title-face-${String(frameNumber).padStart(2, "0")}`,
      frameNumber,
      frameIndex: `0x${hex(frameIndex, 2)}`,
      x: 192,
      y: 24,
      width: 24,
      height: 8,
      path: framePath,
      rgbaSha256: sha256(crop)
    });
  }
  return {
    id: "title-face",
    status: "confirmed",
    routine: "ENTET.BIN:$8EB6",
    targetAddress: "0x43D8",
    source: {
      indexTable: "0x8EF0",
      glyphBase: "0x905B",
      format: "frame index selects 16 bytes: 8 shape rows, then 8 color rows; each row is written at column and column+2"
    },
    frames
  };
}

function extractSparkleFrames(memory, baseVideo, outDir) {
  const positions = readWordTable(memory, 0x8e46, 0xdddd);
  const indexes = readTerminatedBytes(memory, 0x8e5c, 0xdd);
  const frameCount = Math.min(positions.length, indexes.length);
  const frames = [];
  for (let frameNumber = 0; frameNumber < frameCount; frameNumber += 1) {
    const video = cloneVideo(baseVideo);
    for (let item = 0; item <= frameNumber; item += 1) {
      const glyphBase = 0x908b + indexes[item] * 0x10;
      drawSingleColumnGlyph(video.shape, positions[item], memory, glyphBase);
      drawSingleColumnGlyph(video.color, positions[item], memory, glyphBase + 8);
    }
    const rgba = renderScreen(video.color, video.shape);
    const framePath = `startup/animations/title-sparkle-${String(frameNumber).padStart(2, "0")}.png`;
    writeAnimationPngs(outDir, framePath, SCREEN_WIDTH, SCREEN_HEIGHT, rgba);
    frames.push({
      id: `title-sparkle-${String(frameNumber).padStart(2, "0")}`,
      frameNumber,
      positionAddress: `0x${hex(positions[frameNumber], 4)}`,
      frameIndex: `0x${hex(indexes[frameNumber], 2)}`,
      path: framePath,
      rgbaSha256: sha256(rgba)
    });
  }
  return {
    id: "title-sparkles",
    status: "confirmed",
    routine: "ENTET.BIN:$8DFF",
    source: {
      positionTable: "0x8E46",
      indexTable: "0x8E5C",
      glyphBase: "0x908B",
      format: "each item writes one 8x8 shape glyph and one 8x8 color glyph to its screen address"
    },
    frames
  };
}

function extractFeetFrames(memory, baseVideo, outDir) {
  const shapePointers = readWords(memory, 0x8f92, 2);
  const colorPointers = readWords(memory, 0x8f96, 2);
  const pairs = [
    { shapePointer: shapePointers[0], colorPointer: colorPointers[0] },
    { shapePointer: shapePointers[1], colorPointer: colorPointers[1] }
  ];
  const frames = [];
  for (let frameNumber = 0; frameNumber < pairs.length; frameNumber += 1) {
    const video = cloneVideo(baseVideo);
    drawFeetBand(video.shape, memory, pairs[frameNumber].shapePointer);
    drawFeetBand(video.color, memory, pairs[frameNumber].colorPointer);
    const crop = renderCrop(video.color, video.shape, 144, 162, 24, 16);
    const framePath = `startup/animations/title-feet-${String(frameNumber).padStart(2, "0")}.png`;
    writeAnimationPngs(outDir, framePath, 24, 16, crop);
    frames.push({
      id: `title-feet-${String(frameNumber).padStart(2, "0")}`,
      frameNumber,
      shapePointer: `0x${hex(pairs[frameNumber].shapePointer, 4)}`,
      colorPointer: `0x${hex(pairs[frameNumber].colorPointer, 4)}`,
      x: 144,
      y: 162,
      width: 24,
      height: 16,
      path: framePath,
      rgbaSha256: sha256(crop)
    });
  }
  return {
    id: "title-feet",
    status: "confirmed",
    routine: "ENTET.BIN:$8F2D",
    targetAddress: "0x5965",
    source: {
      shapePointerTable: "0x8F92",
      colorPointerTable: "0x8F96",
      format: "routine $8F6E writes three byte-columns for sixteen rows at $5965"
    },
    frames
  };
}

function cloneVideo(video) {
  return {
    color: Buffer.from(video.color),
    shape: Buffer.from(video.shape)
  };
}

function readTerminatedBytes(memory, address, terminator) {
  const values = [];
  for (let cursor = address; cursor < memory.length; cursor += 1) {
    const value = memory[cursor];
    if (value === terminator) break;
    values.push(value);
  }
  return values;
}

function readWordTable(memory, address, terminator) {
  const values = [];
  for (let cursor = address; cursor + 1 < memory.length; cursor += 2) {
    const value = (memory[cursor] << 8) | memory[cursor + 1];
    if (value === terminator) break;
    values.push(value);
  }
  return values;
}

function readWords(memory, address, count) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    values.push((memory[address + index * 2] << 8) | memory[address + index * 2 + 1]);
  }
  return values;
}

function drawSingleColumnGlyph(plane, screenAddress, memory, glyphAddress) {
  for (let row = 0; row < 8; row += 1) {
    const offset = screenAddress - 0x4000 + row * SCREEN_STRIDE_BYTES;
    plane[offset] = memory[glyphAddress + row];
  }
}

function drawDoubleColumnGlyph(plane, screenAddress, memory, glyphAddress) {
  for (let row = 0; row < 8; row += 1) {
    const offset = screenAddress - 0x4000 + row * SCREEN_STRIDE_BYTES;
    const value = memory[glyphAddress + row];
    plane[offset] = value;
    plane[offset + 2] = value;
  }
}

function drawFeetBand(plane, memory, sourceAddress) {
  for (let column = 0; column < 3; column += 1) {
    let targetAddress = 0x5965 - (3 - column);
    for (let row = 0; row < 16; row += 1) {
      plane[targetAddress - 0x4000] = memory[sourceAddress++];
      targetAddress += SCREEN_STRIDE_BYTES;
    }
  }
}

function renderCrop(color, shape, x, y, width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const screenX = x + col;
      const screenY = y + row;
      const offset = screenY * SCREEN_STRIDE_BYTES + (screenX >> 3);
      const isForeground = (shape[offset] & (0x80 >> (screenX & 7))) !== 0;
      const colorIndex = colorIndexFromAttribute(color[offset], isForeground);
      writePixel(rgba, width, col, row, PALETTE[colorIndex]);
    }
  }
  return rgba;
}

function writeAnimationPngs(outDir, path, width, height, rgba) {
  const fullPath = join(outDir, "..", path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, encodePng(width, height, rgba));
}

function executeEntetRoutine(memory, routinePath, startPc, routineRegistry) {
  const color = new Uint8Array(VIDEO_PLANE_BYTES);
  const shape = new Uint8Array(VIDEO_PLANE_BYTES);

  const flags = { z: false, c: false, n: false, v: false };
  const raw = { a: 0, b: 0, x: 0, y: 0, u: 0, s: 0x6fff, pc: 0 };
  Object.defineProperty(raw, "d", {
    get() { return ((this.a << 8) | this.b) & 0xffff; },
    set(value) {
      this.a = (value >> 8) & 0xff;
      this.b = value & 0xff;
    }
  });

  const read8 = (address) => memory[address & 0xffff];
  const write8 = (address, value) => {
    address &= 0xffff;
    value &= 0xff;
    if (address >= 0x4000 && address <= 0x5fff) {
      ((memory[0xe7c3] & 1) !== 0 ? shape : color)[address - 0x4000] = value;
    }
    memory[address] = value;
  };
  const read16 = (address) => (read8(address) << 8) | read8(address + 1);
  const write16 = (address, value) => {
    write8(address, (value >> 8) & 0xff);
    write8(address + 1, value & 0xff);
  };
  const push8 = (value) => {
    raw.s = (raw.s - 1) & 0xffff;
    write8(raw.s, value);
  };
  const pull8 = () => {
    const value = read8(raw.s);
    raw.s = (raw.s + 1) & 0xffff;
    return value;
  };
  const push16Local = (value) => {
    push8(value & 0xff);
    push8((value >> 8) & 0xff);
  };
  const pull16Local = () => (pull8() << 8) | pull8();
  const pushRegister = (register) => {
    if (register === "a") push8(raw.a);
    else if (register === "b") push8(raw.b);
    else if (register === "x") push16Local(raw.x);
    else if (register === "y") push16Local(raw.y);
    else if (register === "u") push16Local(raw.u);
    else if (register === "pc") push16Local(raw.pc);
    else throw new Error(`Unsupported push register ${register}`);
  };
  const pullRegister = (register) => {
    if (register === "a") raw.a = pull8();
    else if (register === "b") raw.b = pull8();
    else if (register === "x") raw.x = pull16Local();
    else if (register === "y") raw.y = pull16Local();
    else if (register === "u") raw.u = pull16Local();
    else if (register === "pc") raw.pc = pull16Local();
    else throw new Error(`Unsupported pull register ${register}`);
  };
  const setZero8 = (value) => {
    flags.z = (value & 0xff) === 0;
    flags.n = (value & 0x80) !== 0;
  };
  const setZero16 = (value) => {
    flags.z = (value & 0xffff) === 0;
    flags.n = (value & 0x8000) !== 0;
  };
  const alu = {
    tst8: setZero8,
    tst16: setZero16,
    clr8(register) {
      raw[register] = 0;
      flags.z = true;
      flags.n = false;
      flags.c = false;
      flags.v = false;
    },
    add8(register, value) {
      const result = raw[register] + value;
      raw[register] = result & 0xff;
      flags.c = result > 0xff;
      setZero8(raw[register]);
    },
    cmp8(register, value) {
      const result = raw[register] - value;
      flags.c = result < 0;
      setZero8(result & 0xff);
    },
    cmp16(register, value) {
      const result = raw[register] - value;
      flags.c = result < 0;
      setZero16(result & 0xffff);
    },
    and8(register, value) {
      raw[register] = raw[register] & value;
      setZero8(raw[register]);
      flags.c = false;
    },
    or8(register, value) {
      raw[register] = raw[register] | value;
      setZero8(raw[register]);
      flags.c = false;
    },
    asl8(register) {
      const value = raw[register];
      flags.c = (value & 0x80) !== 0;
      raw[register] = (value << 1) & 0xff;
      setZero8(raw[register]);
    },
    inc8(register) {
      raw[register] = (raw[register] + 1) & 0xff;
      setZero8(raw[register]);
    },
    dec8(register) {
      raw[register] = (raw[register] - 1) & 0xff;
      setZero8(raw[register]);
    },
    incValue8(value) {
      value = (value + 1) & 0xff;
      flags.z = value === 0;
      flags.n = (value & 0x80) !== 0;
      return value;
    },
    com8(register) {
      raw[register] = (~raw[register]) & 0xff;
      flags.c = true;
      setZero8(raw[register]);
    },
    neg8(register) {
      raw[register] = (0x100 - raw[register]) & 0xff;
      flags.c = raw[register] !== 0;
      setZero8(raw[register]);
    },
    clrValue8() {
      flags.z = true;
      flags.c = false;
      return 0;
    },
    rorValue8(value) {
      const carryIn = flags.c;
      flags.c = (value & 1) !== 0;
      const result = ((carryIn ? 0x80 : 0) | (value >> 1)) & 0xff;
      setZero8(result);
      return result;
    }
  };

  const routineMap = new Map(routineRegistry);
  const ctx = {
    registers: {
      get a() { return raw.a; }, set a(value) { raw.a = value & 0xff; },
      get b() { return raw.b; }, set b(value) { raw.b = value & 0xff; },
      get d() { return raw.d; }, set d(value) { raw.d = value; },
      get x() { return raw.x; }, set x(value) { raw.x = value & 0xffff; },
      get y() { return raw.y; }, set y(value) { raw.y = value & 0xffff; },
      get u() { return raw.u; }, set u(value) { raw.u = value & 0xffff; },
      get s() { return raw.s; }, set s(value) { raw.s = value & 0xffff; },
      get pc() { return raw.pc; }, set pc(value) { raw.pc = value & 0xffff; },
      get flags() { return flags; },
      setFlag(flag, enabled) { flags[flag] = enabled; }
    },
    memory: { read8, write8, read16, write16 },
    alu,
    routines: {
      call(address, context) {
        if (address === 0x8e9e) {
          write8(0xe7c3, read8(0xe7c3) | 1);
          pull16Local();
          return;
        }
        if (address === 0x8eaa) {
          write8(0xe7c3, read8(0xe7c3) & 0xfe);
          pull16Local();
          return;
        }
        const entry = routineMap.get(address & 0xffff);
        if (!entry) {
          throw new Error(`No routine loaded for $${hex(address, 4)}`);
        }
        entry.routine(context, address);
      },
      resumeAt(address, context) {
        context.registers.pc = address;
        return true;
      },
      tailCall(address, context) {
        const entry = routineMap.get(address & 0xffff);
        if (!entry) throw new Error(`No routine loaded for tailcall $${hex(address, 4)}`);
        entry.routine(context, address);
      }
    }
  };

  const helpers = {
    advanceCycles() {},
    callFirmware() {},
    yieldFrameIfNeeded() {},
    pushStackRegisters(_ctx, registers) { for (const register of registers) pushRegister(register); },
    pullStackRegisters(_ctx, registers) { for (const register of registers) pullRegister(register); },
    push16(_ctx, value) { push16Local(value); },
    returnFromRoutine(context) {
      const address = pull16Local();
      context.registers.pc = address;
    },
    resumeOrTailCall(context, address) {
      const entry = routineMap.get(address & 0xffff);
      if (!entry) throw new Error(`No routine loaded for resumeOrTailCall $${hex(address, 4)}`);
      entry.routine(context, address);
    },
    tailCall(context, address) { context.routines.tailCall(address, context); },
    pull16() { return pull16Local(); },
    traceSync() {},
    traceUnsupported() {},
    runCpuInstructionFallback() {}
  };
  Object.assign(globalThis, helpers);

  const entry = routineMap.get(startPc & 0xffff);
  if (!entry) throw new Error(`No routine loaded for start address $${hex(startPc, 4)}`);
  entry.routine(ctx, startPc & 0xffff);

  return {
    color: Buffer.from(color),
    shape: Buffer.from(shape),
    memory
  };
}

function loadRoutineRegistry(routinePaths) {
  const registry = new Map();
  for (const routinePath of routinePaths) {
    const loaded = loadPortedRoutine(routinePath);
    registry.set(loaded.start, loaded);
    if (loaded.addresses) {
      for (const address of loaded.addresses) registry.set(address, loaded);
    }
  }
  return registry;
}

function loadPortedRoutine(routinePath) {
  let source = readFileSync(routinePath, "utf8");
  source = source.replace(/^import[^\n]+\n/gm, "");
  source = source.replace("export function ", "function ");
  const startAddressMatch = source.match(/Address:\s*\$([0-9A-Fa-f]{4})/);
  if (!startAddressMatch) throw new Error(`No start address found in ${routinePath}`);
  const startAddress = Number.parseInt(startAddressMatch[1], 16);

  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const functionName = /function\s+(routine_[a-zA-Z0-9_]+)/.exec(transpiled)?.[1];
  if (!functionName) throw new Error(`No routine function found in ${routinePath}`);
  const routine = eval(`${transpiled}\n${functionName};`);

  const extraAddresses = [];
  for (const match of source.matchAll(/case\s+0x([0-9A-Fa-f]{4})/g)) {
    const address = Number.parseInt(match[1], 16);
    if (address !== startAddress) extraAddresses.push(address);
  }
  return {
    path: routinePath,
    start: startAddress,
    routine,
    addresses: extraAddresses
  };
}

function executeEntet9367(memory, routinePath) {
  const registry = loadRoutineRegistry([routinePath]);
  return executeEntetRoutine(memory, routinePath, 0x9367, registry);
}

function getRoutineEntry(routineRegistry, address) {
  const entry = routineRegistry.get(address & 0xffff);
  if (!entry) throw new Error(`No routine entry for $${hex(address, 4)}`);
  return entry;
}

function overlayBlocks(memory, blocksDir) {
  if (!existsSync(blocksDir)) throw new Error(`Missing blocks directory: ${blocksDir}`);
  for (const fileName of readdirSync(blocksDir)) {
    if (!fileName.startsWith("load-005-ENTET.BIN-block-") && !fileName.startsWith("load-006-ENT.BIN-block-")) continue;
    const match = fileName.match(/\$([0-9A-F]{4})-\$([0-9A-F]{4})\.bin$/i);
    if (!match) continue;
    const start = Number.parseInt(match[1], 16);
    const bytes = readFileSync(join(blocksDir, fileName));
    memory.set(bytes, start);
  }
}

function renderScreen(color, shape) {
  const rgba = Buffer.alloc(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
  for (let y = 0; y < SCREEN_HEIGHT; y += 1) {
    for (let blockX = 0; blockX < SCREEN_STRIDE_BYTES; blockX += 1) {
      const offset = y * SCREEN_STRIDE_BYTES + blockX;
      const shapeByte = shape[offset];
      const colorByte = color[offset];
      for (let bit = 0; bit < 8; bit += 1) {
        const x = blockX * 8 + bit;
        const isForeground = (shapeByte & (0x80 >> bit)) !== 0;
        writePixel(rgba, SCREEN_WIDTH, x, y, PALETTE[colorIndexFromAttribute(colorByte, isForeground)]);
      }
    }
  }
  return rgba;
}

function colorIndexFromAttribute(attribute, shape) {
  const background = ((attribute & 0x07) | ((~attribute & 0x80) >> 4)) & 0x0f;
  const foreground = (((attribute >> 3) & 0x07) | ((~attribute & 0x40) >> 3)) & 0x0f;
  return shape ? foreground : background;
}

function writePixel(rgba, width, x, y, color) {
  const offset = (y * width + x) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
}

function scaleRgba(width, height, rgba, scale) {
  const scaled = Buffer.alloc(width * scale * height * scale * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (y * width + x) * 4;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const targetOffset = ((y * scale + sy) * width * scale + x * scale + sx) * 4;
          rgba.copy(scaled, targetOffset, sourceOffset, sourceOffset + 4);
        }
      }
    }
  }
  return scaled;
}

function encodePng(width, height, rgba) {
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

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
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
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function renderSummary(metadata) {
  return [
    "# Mine Title Extraction",
    "",
    `Source routine: \`${metadata.source.routine}\``,
    "",
    "| id | status | size | png | evidence |",
    "| --- | --- | --- | --- | --- |",
    ...metadata.screens.map((screen) =>
      `| ${screen.id} | ${screen.status} | ${screen.width}x${screen.height} | ${screen.path} | ${screen.evidence.join("<br>")} |`
    ),
    ""
  ].join("\n");
}

function renderTypeScript(metadata) {
  return `/**\n` +
    ` * Generated by tools/extract-mine-title.mjs.\n` +
    ` * Source metadata is embedded in mineTitleMetadata below.\n` +
    ` * Do not edit by hand.\n` +
    ` */\n` +
    `export const mineTitleMetadata = ${JSON.stringify(metadata, null, 2)} as const;\n` +
    `export type MineTitleMetadata = typeof mineTitleMetadata;\n`;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--portage-dir") parsed.portageDir = args[++index];
    else if (arg === "--blocks-dir") parsed.blocksDir = args[++index];
    else if (arg === "--routine") parsed.routinePath = args[++index];
    else if (arg === "--out-dir") parsed.outDir = args[++index];
    else if (arg === "--generated-dir") parsed.generatedDir = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
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
  throw new Error(`None of these paths exist: ${paths.filter(Boolean).join(", ")}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hex(value, length) {
  return value.toString(16).toUpperCase().padStart(length, "0");
}

main();
