export type Logger$level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type Logger$logFn = (data: string | Record<string, unknown>) => void;
export type Logger$format = 'text' | 'json';

export type Logger$data = {
  level: Logger$level;
  message?: unknown;
  timestamp: string;
};

export type Logger$filter = {
  params: string[];
};

export type Logger$config = {
  level: Logger$level;
  format: Logger$format;
  filter: Logger$filter;
  enabled: boolean;
};
