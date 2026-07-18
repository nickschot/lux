export default function hasOwnProperty(
  target: object,
  key: string
): boolean {
  return Reflect.apply(
    Object.prototype.hasOwnProperty,
    target,
    [key]
  );
}
