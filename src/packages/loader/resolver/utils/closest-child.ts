import { posix } from 'path';

import type { Bundle$Namespace } from '../../index';

export default function closestChild<T>(
  source: Bundle$Namespace<T>,
  key: string
): T | undefined {
  const [[, result] = []] = Array.from(source)
    .map(([path, value]): [string, T] => [posix.basename(path), value])
    .filter(([resource]) => key === resource);

  return result;
}
