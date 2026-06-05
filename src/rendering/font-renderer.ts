import { mineFontMetadata } from "../assets/generated/mine-fonts";
import type { Renderer } from "../engine/renderer";

export function drawTo8FontText(
  renderer: Renderer,
  text: string,
  fontId: string,
  x: number,
  y: number,
  color: string
): void {
  const font = mineFontMetadata.fonts.find((item) => item.id === fontId);
  if (!font) {
    renderer.drawPixelText(text, x, y, color);
    return;
  }

  let cursorX = x;
  for (const character of text) {
    const glyph = font.glyphs.find((item) => item.char === character);
    if (!glyph) {
      cursorX += font.width;
      continue;
    }

    for (let row = 0; row < font.height; row += 1) {
      const bits = glyph.rows[row] ?? "";
      for (let column = 0; column < font.width; column += 1) {
        if (bits[column] === "1") {
          renderer.fillRect(cursorX + column, y + row, 1, 1, color);
        }
      }
    }
    cursorX += font.width;
  }
}
