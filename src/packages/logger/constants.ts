import { FreezeableMap, FreezeableSet } from '../freezeable';

import type { Logger$level, Logger$format } from './interfaces';

export const DEBUG = 'DEBUG';
export const INFO = 'INFO';
export const WARN = 'WARN';
export const ERROR = 'ERROR';

export const FORMATS: FreezeableSet<Logger$format> =
  new FreezeableSet<Logger$format>(['text', 'json']);

FORMATS.freeze();

export const LEVELS: FreezeableMap<Logger$level, number> = new FreezeableMap<
  Logger$level,
  number
>([
  [DEBUG, 0],
  [INFO, 1],
  [WARN, 2],
  [ERROR, 3]
]);

LEVELS.freeze();
