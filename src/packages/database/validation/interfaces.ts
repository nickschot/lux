export type ValidationOptions<T> = {
  key: string;
  value: T;
  validator: (value?: T) => boolean;
};
