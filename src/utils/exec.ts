import { exec as nativeExec } from 'child_process';
import type { ExecOptions } from 'child_process';

/**
 * @private
 */
export default function exec(
  cmd: string,
  opts?: ExecOptions
): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    // `utf8` is already child_process.exec's default; passing it explicitly
    // selects the string-returning overload, so callers get `string` rather
    // than `string | Buffer` (which `ExecOptions` alone would permit).
    nativeExec(cmd, { ...opts, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }

      resolve([stdout, stderr]);
    });
  });
}
