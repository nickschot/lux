export type GeneratorOptions = {
  cwd: string;
  type: string;
  name: string;
  attrs: Array<string>;
  onConflict(text: string): Promise<string | boolean>;
};

export type Generator = (opts: GeneratorOptions) => Promise<void>;
export type GeneratorTemplate = (name: string, attrs: Array<string>) => string;
