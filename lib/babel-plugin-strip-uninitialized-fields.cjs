'use strict';

// Removes uninitialized, non-`declare` class fields — e.g. `path: string;` once
// Flow/TS type annotations are stripped. In the Lux source these are type-only
// declarations; the runtime defines the real properties via
// `Object.defineProperties`. Native class-field semantics would instead define
// them as `= undefined` own properties, shadowing the prototype getters/setters
// the framework relies on. This restores the Babel-6 (babel-preset-lux)
// behavior of dropping them. Retire once the tree is TS and fields are modeled
// explicitly (`declare` / real initializers).
module.exports = function stripUninitializedClassFields() {
  return {
    name: 'strip-uninitialized-class-fields',
    visitor: {
      'ClassProperty|ClassPrivateProperty'(path) {
        const { node } = path;

        if (node.value == null && !node.declare) {
          path.remove();
        }
      }
    }
  };
};
