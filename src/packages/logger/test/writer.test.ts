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
      stdoutSpy.reset();
      stderrSpy.reset();
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
                  expect(stderrSpy.firstCall.args[0]).to.include(
                    message.message
                  );
                }
              });
            }
          });
        });
      });
    });
  });
});
