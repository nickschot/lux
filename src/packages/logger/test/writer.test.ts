import { stripVTControlCharacters } from 'util';

import { spy } from 'sinon';
import {
  it,
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  expect
} from 'vitest';

import { WARN, ERROR, LEVELS, FORMATS } from '../constants';
import { createWriter } from '../writer';

describe('module "logger/writer"', () => {
  describe('#createWriter()', () => {
    let stdoutSpy;
    let stderrSpy;

    beforeAll(() => {
      stdoutSpy = spy(process.stdout, 'write');
      stderrSpy = spy(process.stderr, 'write');
    });

    beforeEach(() => {
      stdoutSpy.resetHistory();
      stderrSpy.resetHistory();
    });

    afterAll(() => {
      stdoutSpy.restore();
      stderrSpy.restore();
    });

    FORMATS.forEach(format => {
      describe(`- format "${format}"`, () => {
        let subject;

        beforeAll(() => {
          subject = createWriter(format);
        });

        LEVELS.forEach((num, level) => {
          describe(`- level "${level}"`, () => {
            it('can write message objects', () => {
              const message = 'Hello world!';
              const timestamp = new Date().toISOString();
              let spyForLevel;

              subject({
                level,
                message,
                timestamp
              });

              switch (level) {
                case WARN:
                case ERROR:
                  spyForLevel = stderrSpy;
                  break;

                default:
                  spyForLevel = stdoutSpy;
                  break;
              }

              expect(spyForLevel.calledOnce).to.be.true;
              expect(spyForLevel.firstCall.args[0]).to.include(message);
            });

            if (format === 'text') {
              it('writes one line per entry when output is not a terminal', () => {
                subject({
                  level,
                  message: 'Hello world!',
                  timestamp: '2026-01-01T00:00:00.000Z'
                });

                const written = (
                  level === WARN || level === ERROR ? stderrSpy : stdoutSpy
                ).firstCall.args[0];

                // Vitest's stdout is not a TTY, so there is no rule to draw.
                expect(written.endsWith('Hello world!\n')).to.be.true;
                expect(written).to.not.include('\n\n');
              });
            }

            it('can write nested message objects', () => {
              const message = { message: 'Hello world!' };
              const timestamp = new Date().toISOString();
              let spyForLevel;

              subject({
                level,
                message,
                timestamp
              });

              switch (level) {
                case WARN:
                case ERROR:
                  spyForLevel = stderrSpy;
                  break;

                default:
                  spyForLevel = stdoutSpy;
                  break;
              }

              expect(spyForLevel).to.have.property('calledOnce', true);

              if (format === 'text') {
                expect(spyForLevel.firstCall.args[0]).to.include(
                  JSON.stringify(message, null, 2)
                );
              } else {
                expect(spyForLevel.firstCall.args[0]).to.include(
                  message.message
                );
              }
            });

            if (level === ERROR) {
              it('can write error stack traces', () => {
                const message = new Error('Test');
                const timestamp = new Date().toISOString();

                subject({
                  level,
                  message,
                  timestamp
                });

                expect(stderrSpy).to.have.property('calledOnce', true);

                if (format === 'text') {
                  expect(stderrSpy.firstCall.args[0]).to.include(message.stack);
                } else {
                  expect(JSON.parse(stderrSpy.firstCall.args[0])).to.include({
                    level,
                    message: 'Test',
                    name: 'Error',
                    stack: message.stack
                  });
                }
              });

              if (format === 'json') {
                it('writes context as top-level fields', () => {
                  subject({
                    level,
                    message: new Error('Test'),
                    context: { requestId: 'req-1' },
                    timestamp: new Date().toISOString()
                  });

                  expect(JSON.parse(stderrSpy.firstCall.args[0])).to.include({
                    requestId: 'req-1',
                    message: 'Test'
                  });
                });

                it('names errors by their class, with their own members', () => {
                  class ConflictError extends Error {
                    statusCode = 409;
                  }

                  subject({
                    level,
                    message: new ConflictError('Taken'),
                    timestamp: new Date().toISOString()
                  });

                  expect(JSON.parse(stderrSpy.firstCall.args[0])).to.include({
                    message: 'Taken',
                    name: 'ConflictError',
                    statusCode: 409
                  });
                });
              }
            }
          });
        });
      });
    });
  });

  describe('- text layout', () => {
    let stdoutSpy;
    let stderrSpy;

    beforeEach(() => {
      stdoutSpy = spy(process.stdout, 'write');
      stderrSpy = spy(process.stderr, 'write');
    });

    afterEach(() => {
      stdoutSpy.restore();
      stderrSpy.restore();
    });

    const timestamp = '2026-01-01T00:00:00.000Z';
    const plain = (spied): string =>
      stripVTControlCharacters(spied.firstCall.args[0]);

    it('spells out the level, padded to line up', () => {
      createWriter('text')({ level: 'INFO', message: 'Hi', timestamp });
      createWriter('text')({ level: 'ERROR', message: 'Oh', timestamp });

      expect(plain(stdoutSpy)).to.equal(`[${timestamp}] INFO  Hi\n`);
      expect(plain(stderrSpy)).to.equal(`[${timestamp}] ERROR Oh\n`);
    });

    it('shows the first 8 characters of a request id', () => {
      createWriter('text')({
        level: 'INFO',
        message: 'Hi',
        context: { requestId: '8f1c2b9e-4a7d-4c1e-9b2a-1d3e5f7a9c0b' },
        timestamp
      });

      expect(plain(stdoutSpy)).to.equal(`[${timestamp}] INFO  [8f1c2b9e] Hi\n`);
    });

    it('can leave the timestamp to the platform', () => {
      createWriter('text', { timestamps: false })({
        level: 'WARN',
        message: 'Careful',
        timestamp
      });

      expect(plain(stderrSpy)).to.equal('WARN  Careful\n');
    });
  });
});
