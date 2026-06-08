declare module "node:child_process" {
  export function execSync(command: string, options: { readonly encoding: "utf8" }): string;
}

declare module "node:fs" {
  export function cpSync(source: string, destination: string, options: { readonly recursive: boolean }): void;
  export function existsSync(path: string): boolean;
}

declare module "node:path" {
  export function resolve(...paths: readonly string[]): string;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
