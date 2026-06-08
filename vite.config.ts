import { defineConfig } from "vite";
import { execSync } from "node:child_process";

function readGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  base: "/la-mine-aux-diamants-to8-web/",
  define: {
    __APP_VERSION__: JSON.stringify(readGitCommit())
  },
  build: {
    target: "es2022"
  },
  server: {
    host: "0.0.0.0"
  },
  preview: {
    host: "0.0.0.0"
  }
});
