import type Logger from '../../logger';

export type ClusterOptions = {
  path: string;
  port: number;
  logger: Logger;
  maxWorkers?: number;
  shutdownTimeout?: number;
};
