import { it, describe, expect } from 'vitest';

import { parseAccept, parseMediaType } from '../index';

describe('module "jsonapi"', () => {
  describe('#parseMediaType()', () => {
    it('lowercases the type and returns no params when there are none', () => {
      expect(parseMediaType('Application/VND.API+JSON')).to.deep.equal({
        type: 'application/vnd.api+json',
        params: []
      });
    });

    it('trims whitespace around the type and each parameter', () => {
      expect(
        parseMediaType(' application/vnd.api+json ; charset=utf-8 ;a=b ')
      ).to.deep.equal({
        type: 'application/vnd.api+json',
        params: ['charset=utf-8', 'a=b']
      });
    });

    it('ignores empty parameters', () => {
      expect(parseMediaType('application/vnd.api+json;').params).to.be.empty;
    });

    it('does not split on `;` inside a quoted parameter value', () => {
      expect(parseMediaType('text/plain; a="x;y"; b=1').params).to.deep.equal([
        'a="x;y"',
        'b=1'
      ]);
    });
  });

  describe('#parseAccept()', () => {
    it('splits media ranges on commas', () => {
      expect(
        parseAccept('application/vnd.api+json, text/html').map(r => r.type)
      ).to.deep.equal(['application/vnd.api+json', 'text/html']);
    });

    it('does not split on `,` inside a quoted parameter value', () => {
      expect(parseAccept('application/vnd.api+json;a="x,y"')).to.deep.equal([
        { type: 'application/vnd.api+json', params: ['a="x,y"'] }
      ]);
    });

    it('does not end a quoted value at an escaped quote', () => {
      expect(parseAccept('text/plain;a="x\\",y", text/html')).to.have.length(2);
    });

    it('excludes the `q` weight and what follows from media params', () => {
      expect(
        parseAccept('application/vnd.api+json;ext=bulk;q=0.9;foo=bar')
      ).to.deep.equal([
        { type: 'application/vnd.api+json', params: ['ext=bulk'] }
      ]);

      expect(parseAccept('application/vnd.api+json; Q=0.5')).to.deep.equal([
        { type: 'application/vnd.api+json', params: [] }
      ]);
    });

    it('drops empty media ranges', () => {
      expect(parseAccept(' , application/vnd.api+json,')).to.have.length(1);
    });
  });
});
