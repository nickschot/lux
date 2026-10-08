import { spawn, type ChildProcess } from 'child_process';
import net from 'net';
import { resolve as resolvePath } from 'path';
import { setTimeout as sleep } from 'timers/promises';

import { describe, it, afterEach, expect } from 'vitest';

// `lumen serve` end to end, as a platform runs it: the real CLI, master and
// worker processes, against the test-app.
const ROOT = resolvePath(import.meta.dirname, '../../../..');
const APP = resolvePath(ROOT, 'test/test-app');
const PORT = 4183;

type Exit = { code: number | null; signal: NodeJS.Signals | null };

function serve(env: Record<string, string> = {}) {
  const child = spawn(
    process.execPath,
    [resolvePath(ROOT, 'bin/lumen'), 'serve'],
    {
      cwd: APP,
      env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), ...env },
      stdio: 'ignore'
    }
  );

  const exited = new Promise<Exit>(resolve => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  return { child, exited };
}

function connect(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, '127.0.0.1', () => resolve(socket));
    socket.once('error', reject);
  });
}

async function listening() {
  for (let i = 0; i < 240; i += 1) {
    try {
      (await connect()).end();
      return;
    } catch {
      await sleep(250);
    }
  }

  throw new Error(`lumen serve did not listen on port ${PORT}`);
}

describe('lumen serve', () => {
  let child: ChildProcess | undefined;

  afterEach(() => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  });

  it('finishes requests in flight on SIGTERM, refuses new ones, and exits 0', async () => {
    const server = serve();

    child = server.child;
    await listening();

    // A request still in flight: its body is only half sent when the signal
    // arrives. (It is answered 400 — an unknown attribute — so nothing is
    // written to the shared database.)
    const body = JSON.stringify({
      data: { type: 'posts', attributes: { nope: 1 } }
    });
    const half = Math.floor(body.length / 2);
    const socket = await connect();
    let response = '';

    socket.on('data', chunk => {
      response += chunk;
    });

    const closed = new Promise(resolve => socket.once('close', resolve));

    socket.write(
      'POST /posts HTTP/1.1\r\nHost: localhost\r\n' +
        'Content-Type: application/vnd.api+json\r\n' +
        `Content-Length: ${body.length}\r\n\r\n${body.slice(0, half)}`
    );
    await sleep(300);

    child.kill('SIGTERM');
    await sleep(1000);

    await expect(connect()).rejects.toMatchObject({ code: 'ECONNREFUSED' });

    socket.write(body.slice(half));
    await closed;

    expect(response).to.match(/^HTTP\/1\.1 400 Bad Request/);
    expect(await server.exited).to.deep.equal({ code: 0, signal: null });
  }, 90000);

  it('exits 1 when the application cannot start', async () => {
    const server = serve({ DATABASE_URL: '/nonexistent/lumen/db.sqlite' });

    child = server.child;

    expect(await server.exited).to.deep.equal({ code: 1, signal: null });
  }, 90000);
});
