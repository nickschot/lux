/**
 * @private
 */
export default function uniq<T>(src: T[], ...keys: string[]): T[] {
  const hasKeys = Boolean(keys.length);
  const valueAt = (obj: T, key: string): unknown =>
    (obj as unknown as Record<string, unknown>)[key];

  return src.filter((x, xIdx, arr) => {
    let lastIdx: number;

    if (hasKeys) {
      lastIdx = arr.findIndex(
        (y, yIdx) =>
          yIdx > xIdx || keys.every(key => valueAt(x, key) === valueAt(y, key))
      );
    } else {
      lastIdx = src.lastIndexOf(x);
    }

    return xIdx === lastIdx;
  });
}
