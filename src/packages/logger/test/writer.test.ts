import { spy } from 'sinon';
import { it, describe, beforeAll, beforeEach, afterAll, expect } from 'vitest';

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
});
