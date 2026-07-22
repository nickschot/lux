/**
 * @private
 */
export type Migration$Fn<T extends object> = (schema: T) => T;
