/**
 * @private
 */
export default function insert<T, U extends T[]>(target: U, items: T[]): U {
  for (let i = 0; i < items.length; i += 1) {
    target.splice(i, 1, items[i]);
  }

  return target;
}
