import type { LoggerConfig } from '../logger';
import type { ServerConfig } from '../server';

export type Config = {
  logging: LoggerConfig;
  server: ServerConfig;
};
