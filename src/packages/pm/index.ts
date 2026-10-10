import Cluster from './cluster';
import type { ClusterOptions } from './cluster';

/**
 * @private
 */
export function createCluster({
  path,
  port,
  logger,
  maxWorkers,
  shutdownTimeout
}: ClusterOptions) {
  return new Cluster({
    path,
    port,
    logger,
    maxWorkers,
    shutdownTimeout
  });
}
