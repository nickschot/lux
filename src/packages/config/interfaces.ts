import type { LoggerConfig } from '../logger';
import type { ServerConfig } from '../server';

/**
 * The contents of `config/environments/<environment>.js`. Every member is
 * merged over the defaults, so an environment file sets only what differs.
 */
export type Config = {
  /** How and what the app logs; see {@link LoggerConfig}. */
  logging: LoggerConfig;

  /** CORS and proxy settings; see {@link ServerConfig}. */
  server: ServerConfig;
};
