import type { Request$params } from '../../../../server';
import type { JSONAPI$DocumentLinks } from '../../../../jsonapi';

const PAGE_NUMBER = 'page[number]';

/**
 * Percent-encode a query string component, leaving commas — which separate
 * list values (`include=user,comments`) and are allowed in a query — as is.
 *
 * @private
 */
function encode(value: string): string {
  return encodeURIComponent(value).replace(/%2C/gi, ',');
}

function createLinkTemplate({
  search,
  domain,
  pathname
}: {
  search: string;
  domain: string;
  pathname: string;
}) {
  const baseURL = `${domain}${pathname}`;

  // The request's own query, as the client wrote it (member names, order,
  // values), so links round-trip exactly; only the page number varies.
  const query = Array.from(new URLSearchParams(search)).filter(
    ([key]) => key !== PAGE_NUMBER
  );

  return function linkTemplate(pageNum: number): string {
    const pairs =
      pageNum > 1 ? [...query, [PAGE_NUMBER, String(pageNum)]] : query;

    if (!pairs.length) {
      return baseURL;
    }

    return `${baseURL}?${pairs
      .map(([key, value]) => `${encode(key)}=${encode(value)}`)
      .join('&')}`;
  };
}

/**
 * The top level `links` of a paginated collection. `self` is always the page
 * requested — even past the last one, where `prev`/`next` are `null` — and
 * every link keeps the rest of the request's query string as is.
 *
 * @private
 */
export default function createPageLinks(opts: {
  total: number;
  params: Request$params;
  search: string;
  domain: string;
  pathname: string;
  defaultPerPage: number;
}): JSONAPI$DocumentLinks {
  const { page: { number = 1, size = opts.defaultPerPage } = {} } = opts.params;
  const lastPageNum = opts.total > 0 ? Math.ceil(opts.total / size) : 1;
  const linkForPage = createLinkTemplate(opts);
  const inRange = (pageNum: number) => pageNum >= 1 && pageNum <= lastPageNum;

  return {
    self: linkForPage(number),
    first: linkForPage(1),
    last: linkForPage(lastPageNum),
    prev: inRange(number - 1) ? linkForPage(number - 1) : null,
    next: inRange(number + 1) ? linkForPage(number + 1) : null
  };
}
