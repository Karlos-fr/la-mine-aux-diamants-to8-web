import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function readGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  base: "/la-mine-aux-diamants-to8-web/",
  plugins: [copyDocsExtractionAssets()],
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

function copyDocsExtractionAssets() {
  return {
    name: "copy-docs-extraction-assets",
    closeBundle(): void {
      const source = resolve("docs/extraction");
      if (!existsSync(source)) return;
      cpSync(source, resolve("dist/docs/extraction"), { recursive: true });
    }
  };
}
