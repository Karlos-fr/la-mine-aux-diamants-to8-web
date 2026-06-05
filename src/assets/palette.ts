export const TO8_PALETTE = {
  black: "#000000",
  ink: "#101018",
  white: "#f5f5f5",
  yellow: "#f0d050",
  blue: "#2450d8",
  cyan: "#58c8f0",
  green: "#28a840",
  lightGreen: "#78e060",
  red: "#d83838",
  magenta: "#c050c8",
  gray: "#909090",
  darkGray: "#404040"
} as const;

export type PaletteName = keyof typeof TO8_PALETTE;
