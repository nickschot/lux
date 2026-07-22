// `ora` (the version pinned here) ships no type declarations. Only the spinner
// surface the CLI uses is declared.
declare module 'ora' {
  export default class Ora {
    constructor(options?: { text?: string; spinner?: string });
    start(text?: string): this;
    stop(): this;
    succeed(text?: string): this;
    fail(text?: string): this;
  }
}
