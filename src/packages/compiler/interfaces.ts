export type ManifestWriter = (
  value: string | Array<string>,
  resolveName?: (value: string) => string,
  resolveExport?: (value: string) => string
) => Promise<void>;
