import type { Response } from '../index';
import type { CorsConfig } from '../interfaces';

export default function setCORSHeaders(
  res: Response,
  { origin, methods, headers, enabled }: CorsConfig
) {
  if (!enabled) {
    return;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  if (methods) {
    res.setHeader('Access-Control-Allow-Methods', methods.join());
  }

  if (headers) {
    res.setHeader('Access-Control-Allow-Headers', headers.join());
  }
}
