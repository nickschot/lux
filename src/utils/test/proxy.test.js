// @flow
import { expect } from 'chai';
import { it, describe, beforeEach } from 'mocha';

import * as proxy from '../proxy';

describe('util proxy', () => {
  describe('.trapGet()', () => {
    let base;
    let proxied;

    class Circle {
      radius: number;

      constructor(radius) {
        this.radius = radius;
      }

      get diameter() {
        return this.radius * 2;
      }

      area() {
        return Math.PI * (this.radius ** 2);
      }
    }

    beforeEach(() => {
      const traps = {
        isProxied: true,

        shortArea(target) {
          return Math.round(target.area() * 100) / 100;
        }
      };

      base = new Circle(10);
      proxied = new Proxy(base, {
        get: proxy.trapGet(traps)
      });
    });

    describe('- properties', () => {
      it('captures and returns values defined in as traps', () => {
        // $FlowIgnore
        expect(proxied.isProxied).to.be.true;
      });

      it('forwards unknown properties to the proxy target', () => {
        expect(proxied.radius).to.equal(base.radius);
      });
    });

    describe('- methods', () => {
      it('captures and returns values defined in as traps', () => {
        // $FlowIgnore
        expect(proxied.shortArea()).to.equal(314.16);
      });

      it('forwards unknown methods to the proxy target', () => {
        expect(proxied.area()).to.equal(base.area());
      });
    });

    describe('#unwrap', () => {
      it('returns the proxy target', () => {
        // $FlowIgnore
        expect(proxied.unwrap()).to.equal(base);
      });
    });
  });
});
