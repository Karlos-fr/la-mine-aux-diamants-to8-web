/**
 * Role: Expose la version applicative injectee par Vite.
 * Scope: Le hash Git court est fourni au build via `vite.config.ts`.
 */

declare const __APP_VERSION__: string;

/** Version affichee dans les credits runtime. */
export const APP_VERSION = __APP_VERSION__;
