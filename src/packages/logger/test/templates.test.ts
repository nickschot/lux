import { stripVTControlCharacters } from 'util';

import { it, describe, expect } from 'vitest';

import { infoTemplate, debugTemplate } from '../request-logger/templates';
import type { RequestLogger$templateData } from '../request-logger/interfaces';

function dataFor(route?: unknown): RequestLogger$templateData {
  return {
    path: '/nowhere',
    stats: [],
    route: route as RequestLogger$templateData['route'],
    method: 'GET',
    params: {},
    startTime: 0,
    endTime: 5,
    statusCode: '404',
    statusMessage: 'Not Found',
    remoteAddress: '::1',
    colorStr: (str: string) => str
  };
}

describe('module "logger/request-logger/templates"', () => {
  const route = {
    action: 'index',
    controller: new (class PostsController {})()
  };

  [infoTemplate, debugTemplate].forEach(template => {
    describe(`#${template === infoTemplate ? 'info' : 'debug'}Template()`, () => {
      it('names the controller action that handled the request', () => {
        expect(stripVTControlCharacters(template(dataFor(route)))).to.include(
          'by PostsController#index'
        );
      });

      it('leaves the handler out when no route matched', () => {
        const text = stripVTControlCharacters(template(dataFor()));

        expect(text).to.not.include(' by ');
        expect(text).to.not.include('null');
      });
    });
  });

  describe('#infoTemplate() layout', () => {
    it('is one plain line: method, path, status, time, handler, client, params', () => {
      const text = stripVTControlCharacters(
        infoTemplate({
          ...dataFor(route),
          params: { page: { size: 20 }, filter: { title: 'two  spaces' } }
        })
      );

      expect(text).to.equal(
        'GET /nowhere 404 Not Found in 5 ms by PostsController#index ' +
          'from ::1 {"page":{"size":20},"filter":{"title":"two  spaces"}}'
      );
    });

    it('leaves out empty params and an unknown client', () => {
      const text = stripVTControlCharacters(
        infoTemplate({ ...dataFor(), remoteAddress: undefined })
      );

      expect(text).to.equal('GET /nowhere 404 Not Found in 5 ms');
    });
  });
});
