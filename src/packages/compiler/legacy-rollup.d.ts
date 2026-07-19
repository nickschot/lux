// Rollup 0.43 and its plugins (the legacy app compiler, slated for rework in
// Phase 5) ship no type declarations. They are used only as values here, so an
// ambient, any-typed module for each is the honest shape.
declare module 'rollup';
declare module 'rollup-plugin-lux';
declare module 'rollup-plugin-json';
declare module 'rollup-plugin-alias';
declare module 'rollup-plugin-babel';
declare module 'rollup-plugin-eslint';
declare module 'rollup-plugin-node-resolve';
