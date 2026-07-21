import { it, describe, beforeAll, afterEach, expect } from 'vitest';

import Logger, { line } from '../index';
import sleep from '../../../utils/sleep';

const TEST_MESSAGE = 'test';

describe('module "logger"', () => {
  describe('class Logger', () => {
    let jsonLogger: Logger;
    let disabledLogger: Logger;
    let unhookWrite: (() => void) | null;

    // Vitest has no `done` callback, so the write hook is surfaced as a
    // promise that resolves with the first intercepted line.
    const nextWrite = () =>
      new Promise<string>(resolve => {
        unhookWrite = hookWrite(resolve);
      });

    beforeAll(async () => {
      const baseConfig = {
        level: 'INFO',
        format: 'json',
        enabled: true,
        filter: { params: [] }
      };
      jsonLogger = new Logger(baseConfig);
      const disabledConfig = Object.assign({}, baseConfig, { enabled: false });
      disabledLogger = new Logger(disabledConfig);
    });

    afterEach(() => {
      if (unhookWrite) {
        unhookWrite();
        unhookWrite = null;
      }
    });

    it('writes to stdout at the logger level', async () => {
      const written = nextWrite();

      jsonLogger.info(TEST_MESSAGE);

      const { message, level } = JSON.parse(await written);

      expect(message).to.equal(TEST_MESSAGE);
      expect(level).to.equal('INFO');
    });

    it('does write messages above the logger level', async () => {
      const written = nextWrite();

      jsonLogger.warn(TEST_MESSAGE);

      const { message, level } = JSON.parse(await written);

      expect(message).to.equal(TEST_MESSAGE);
      expect(level).to.equal('WARN');
    });

    it('does not write messages below the logger level', async () => {
      let wrote = false;

      unhookWrite = hookWrite(() => {
        wrote = true;
      });

      jsonLogger.debug(TEST_MESSAGE);
      await sleep(50);

      expect(wrote).to.be.false;
    });

    it('writes with a recent timestamp', async () => {
      const before = Date.now();
      const written = nextWrite();

      jsonLogger.info(TEST_MESSAGE);

      const { timestamp } = JSON.parse(await written);
      const logged = Date.parse(timestamp);

      // The logger stamps its own `Date` a moment after `before`, so the logged
      // time must fall in the window [before, now]. Asserting that window is
      // robust; exact equality with `before` lost a 1 ms race intermittently.
      expect(logged).to.be.at.least(before);
      expect(logged).to.be.at.most(Date.now());
    });

    it('writes json', async () => {
      const written = nextWrite();

      jsonLogger.info(TEST_MESSAGE);

      const output = (await written).trim();

      expect(JSON.stringify(JSON.parse(output))).to.equal(output);
    });

    it('does not write when disabled', async () => {
      let wrote = false;

      unhookWrite = hookWrite(() => {
        wrote = true;
      });

      disabledLogger.info(TEST_MESSAGE);
      await sleep(50);

      expect(wrote).to.be.false;
    });
  });

  describe('#line()', () => {
    it('returns a single line string from a multi-line string', () => {
      expect(line`
        this
        is
        a
        test
      `).to.equal('this is a test');
    });
  });
});

function hookWrite(cb: (line: string) => void) {
  const oldStdoutWrite = process.stdout.write;
  const oldStderrorWrite = process.stderr.write;

  const cbWrapper = (...args: [string]) => {
    if (isLoggerData(...args)) {
      Reflect.apply(cb, null, args);
    }
  };

  // `write` is overloaded, so the interceptor needs a cast to install.
  process.stdout.write = cbWrapper as typeof process.stdout.write;
  process.stderr.write = cbWrapper as typeof process.stderr.write;

  return function () {
    process.stdout.write = oldStdoutWrite;
    process.stderr.write = oldStderrorWrite;
  };
}

function isLoggerData(line: string) {
  try {
    const data = JSON.parse(line);
    return data.timestamp && data.message && data.level;
  } catch {
    return false;
  }
}
