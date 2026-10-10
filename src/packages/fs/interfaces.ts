export type WriteOptions =
  | string
  | {
      mode?: number;
      flag?: string;
      encoding?: string | null;
    };

export type ReadOptions =
  | string
  | {
      flag?: string;
      encoding?: string | null;
    };

export type PathRemover = (source: string) => string;

export interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
  relative: string;
  absolute: string;
}
