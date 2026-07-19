// TEMPORARY type shim for the not-yet-converted `fs` package (Flow .js).
// Declares only `readdir`, the single symbol `database` imports from it. Delete
// this file when `fs` is converted to TypeScript. Runtime is unaffected:
// Babel/esbuild ignore `.d.ts`, so the real `fs/index.js` is what loads.
export function readdir(path: string): Promise<Array<string>>;
