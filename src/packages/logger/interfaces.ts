export type Logger$level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
/**
 * `context` is written alongside the message as top-level fields in JSON
 * format (e.g. a `requestId` tying an error to its request line); the text
 * format leaves it out.
 */
export type Logger$logFn = (
  data: string | Record<string, unknown>,
  context?: Record<string, unknown>
) => void;
export type Logger$format = 'text' | 'json';

export type Logger$data = {
  level: Logger$level;
  message?: unknown;
  context?: Record<string, unknown>;
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
  requestBody?: boolean;
  timestamps?: boolean;
};
