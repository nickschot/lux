export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
/**
 * `context` is written alongside the message as top-level fields in JSON
 * format (e.g. a `requestId` tying an error to its request line); the text
 * format leaves it out.
 */
export type LogFunction = (
  data: string | Record<string, unknown>,
  context?: Record<string, unknown>
) => void;
export type LogFormat = 'text' | 'json';

export type Logger$data = {
  level: LogLevel;
  message?: unknown;
  context?: Record<string, unknown>;
  timestamp: string;
};

export type LogFilter = {
  params: string[];
};

export type LoggerConfig = {
  level: LogLevel;
  format: LogFormat;
  filter: LogFilter;
  enabled: boolean;
  requestBody?: boolean;
  timestamps?: boolean;
};
