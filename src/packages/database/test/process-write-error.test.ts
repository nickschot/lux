import { it, describe, expect } from 'vitest';

import { UniqueConstraintError } from '../errors';
import processWriteError from '../model/utils/process-write-error';

function withCode(message: string, code?: string): Error {
  return Object.assign(new Error(message), { code });
}

const SQL = "insert into `users` (`email`) values ('a@b.c')";

describe('module "database"', () => {
  describe('#processWriteError()', () => {
    const unique: Array<[string, Error]> = [
      [
        'sqlite',
        withCode(
          `${SQL} - SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email`,
          'SQLITE_CONSTRAINT'
        )
      ],
      [
        'pg',
        withCode(
          `${SQL} - duplicate key value violates unique constraint "u"`,
          '23505'
        )
      ],
      [
        'mysql',
        withCode(
          `${SQL} - Duplicate entry 'a@b.c' for key 'users.email'`,
          'ER_DUP_ENTRY'
        )
      ],
      ['mssql', withCode(`${SQL} - Violation of UNIQUE KEY constraint 'u'.`)]
    ];

    unique.forEach(([driver, err]) => {
      it(`maps a ${driver} unique violation to a 409`, () => {
        const result = processWriteError(err);

        expect(result).to.be.an.instanceof(UniqueConstraintError);
        expect(result).to.have.property('statusCode', 409);
      });
    });

    it('drops the SQL (and its bound values) from the message', () => {
      const [, err] = unique[0];
      const { message } = processWriteError(err) as Error;

      expect(message).to.equal(
        'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email'
      );
    });

    it('matches on every call, not every other one', () => {
      const [, err] = unique[0];

      for (let i = 0; i < 3; i++) {
        expect(processWriteError(err)).to.be.an.instanceof(
          UniqueConstraintError
        );
      }
    });

    it('passes other errors through untouched', () => {
      const err = withCode('SQLITE_CONSTRAINT: NOT NULL', 'SQLITE_CONSTRAINT');

      expect(processWriteError(err)).to.equal(err);
      expect(processWriteError('nope')).to.equal('nope');
    });
  });
});
