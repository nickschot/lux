/* eslint-disable @typescript-eslint/no-explicit-any --
 * Normalizes the overloaded `resource(name, opts?, builder?)` argument forms
 * the public route DSL accepts. The input tuple is genuinely untyped until this
 * function resolves it into the structured `[opts, builder]` return shape.
 */
import {
  BUILT_IN_ACTIONS,
  type Controller$builtIn
} from '../../../../controller';

/**
 * @private
 */
export default function normalizeResourceArgs(args: Array<any>): [
  {
    name: string;
    path: string;
    only: Array<Controller$builtIn>;
  },
  () => void
] {
  const [name] = args;
  let [, opts, builder] = args;

  if (!opts) {
    opts = {
      path: '',
      only: undefined
    };
  }

  if (typeof opts === 'function') {
    builder = opts;
    opts = {
      path: '',
      only: undefined
    };
  }

  if (typeof builder !== 'function') {
    builder = () => undefined;
  }

  opts = {
    ...opts,
    name
  };

  if (!opts.path) {
    opts = {
      ...opts,
      path: `/${name}`
    };
  }

  if (!opts.only) {
    opts = {
      ...opts,
      only: [...BUILT_IN_ACTIONS]
    };
  }

  return [opts, builder];
}
