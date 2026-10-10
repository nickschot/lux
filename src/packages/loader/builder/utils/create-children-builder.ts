import type { BuilderConstruct, ChildrenBuilder } from '../interfaces';

export default function createChildrenBuilder<T>(
  construct: BuilderConstruct<T>
): ChildrenBuilder<T> {
  return target =>
    target.map(({ key, value, parent }) =>
      Array.from(value).map(([name, constructor]): [string, T] => {
        const normalized = key === 'root' ? name : `${key}/${name}`;

        if (parent && normalized.endsWith('application')) {
          return [normalized, parent];
        }

        return [normalized, construct(normalized, constructor, parent)];
      })
    );
}
