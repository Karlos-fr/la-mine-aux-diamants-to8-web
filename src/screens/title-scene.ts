import { TO8_PALETTE } from "../assets/palette";
import type { InputState } from "../engine/input";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { GameplayScene } from "./gameplay-scene";

export class TitleScene implements Scene {
  private context: SceneContext | undefined;
  private elapsed = 0;

  enter(context: SceneContext): void {
    this.context = context;
  }

  update(dt: number, input: InputState): void {
    this.elapsed += dt;

    if (input.justPressed.confirm || input.justPressed.action) {
      this.context?.setScene(new GameplayScene());
    }
  }

  render(renderer: Renderer): void {
    renderer.clear(TO8_PALETTE.black);
    renderer.strokeRect(8, 8, 304, 184, TO8_PALETTE.blue);
    renderer.strokeRect(12, 12, 296, 176, TO8_PALETTE.yellow);

    this.drawCentered(renderer, "LA MINE", 50, TO8_PALETTE.yellow, 3);
    this.drawCentered(renderer, "AUX DIAMANTS", 78, TO8_PALETTE.white, 2);

    if (Math.floor(this.elapsed * 2) % 2 === 0) {
      this.drawCentered(renderer, "APPUYEZ SUR LA BARRE", 142, TO8_PALETTE.green, 1);
    }
  }

  private drawCentered(
    renderer: Renderer,
    text: string,
    y: number,
    color: string,
    scale: number
  ): void {
    const x = Math.floor((renderer.width - renderer.measurePixelText(text, scale)) / 2);
    renderer.drawPixelText(text, x, y, color, scale);
  }
}
