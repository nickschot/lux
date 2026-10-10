import { posix } from 'path';

import type { BundleNamespace } from '../../index';

export default function closestChild<T>(
  source: BundleNamespace<T>,
  key: string
): T | undefined {
  const [[, result] = []] = Array.from(source)
    .map(([path, value]): [string, T] => [posix.basename(path), value])
    .filter(([resource]) => key === resource);

  return result;
}
