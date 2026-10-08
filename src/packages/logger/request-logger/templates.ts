import chalk from '../../../utils/chalk';
import line from '../utils/line';

import type { RequestLogger$templateData } from './interfaces';

/** @internal */
function countDigits(num: number) {
  const digits = Math.floor(Math.log10(num) + 1);

  return digits > 0 && Number.isFinite(digits) ? digits : 1;
}

/** @internal */
function pad(startTime: number, endTime: number, duration: number) {
  const maxLength = countDigits(endTime - startTime);

  return ' '.repeat(maxLength - countDigits(duration)) + duration;
}

/**
 * ` by PostsController#index`, or nothing when no route matched (it used to
 * read `by null`).
 *
 * @internal
 */
function handledBy(route: RequestLogger$templateData['route']) {
  if (!route) {
    return '';
  }

  const { controller, action } = route;

  return ` by ${chalk.yellow(controller.constructor.name)}#${chalk.blue(action)}`;
}

/** @internal */
export const debugTemplate = ({
  path,
  stats,
  route,
  method,
  params,
  colorStr,
  startTime,
  endTime,
  statusCode,
  statusMessage,
  remoteAddress
}: RequestLogger$templateData) => `\
${line`
  Processed ${chalk.cyan(`${method}`)} "${path}" from ${remoteAddress}
  with ${colorStr(`${statusCode}`)}
  ${colorStr(`${statusMessage}`)}${handledBy(route)}
`}

${chalk.magenta('Params')}

${JSON.stringify(params, null, 2)}

${chalk.magenta('Stats')}

${stats
  .map(stat => {
    const { type, duration, controller } = stat;
    let { name } = stat;

    name = chalk.blue(name);

    if (type === 'action') {
      name = `${chalk.yellow(controller)}#${name}`;
    }

    return `${pad(startTime, endTime, duration)} ms ${name}`;
  })
  .join('\n')}
${pad(
  startTime,
  endTime,
  stats.reduce((total, { duration }) => total + duration, 0)
)} ms Total
${(endTime - startTime).toString()} ms Actual\
`;

/** @internal */
export const infoTemplate = ({
  path,
  route,
  method,
  params,
  colorStr,
  startTime,
  endTime,
  statusCode,
  statusMessage,
  remoteAddress
}: RequestLogger$templateData) =>
  // Built directly rather than with `line`, which would also collapse runs
  // of spaces inside param values.
  [
    chalk.cyan(method),
    path,
    colorStr(`${statusCode} ${statusMessage}`),
    `in ${endTime - startTime} ms${handledBy(route)}`,
    remoteAddress ? `from ${remoteAddress}` : '',
    Object.keys(params).length ? JSON.stringify(params) : ''
  ]
    .filter(Boolean)
    .join(' ');
