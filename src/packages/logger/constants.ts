import { FreezeableMap, FreezeableSet } from '../freezeable';

import type { LogLevel, LogFormat } from './interfaces';

export const DEBUG = 'DEBUG';
export const INFO = 'INFO';
export const WARN = 'WARN';
export const ERROR = 'ERROR';

export const FORMATS: FreezeableSet<LogFormat> = new FreezeableSet<LogFormat>([
  'text',
  'json'
]);

FORMATS.freeze();

export const LEVELS: FreezeableMap<LogLevel, number> = new FreezeableMap<
  LogLevel,
  number
>([
  [DEBUG, 0],
  [INFO, 1],
  [WARN, 2],
  [ERROR, 3]
]);

LEVELS.freeze();
