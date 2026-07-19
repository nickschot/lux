/* eslint-disable @typescript-eslint/no-explicit-any --
 * `fb-watchman` ships no type declarations, and the watchman wire protocol is
 * dynamic (arbitrary JSON responses keyed by command), so the command/response
 * callbacks are genuinely `any` here.
 */
declare module 'fb-watchman' {
  export class Client {
    capabilityCheck(
      opts: object,
      cb: (err: Error | null, resp?: any) => void
    ): void;
    command(
      args: Array<unknown>,
      cb: (err: Error | null, resp?: any) => void
    ): void;
    on(event: string, listener: (resp: any) => void): void;
    end(): void;
  }
}
