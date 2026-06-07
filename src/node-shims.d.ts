declare module "node:child_process" {
  export function execSync(command: string, options: { readonly encoding: "utf8" }): string;
}
