import indent from '../utils/indent';
import underscore from '../../../utils/underscore';

const SUFFIXES: Record<string, string> = {
  development: 'dev',
  test: 'test',
  production: 'prod'
};

/**
 * @private
 */
export default (name: string, driver: string): string => {
  const schemaName = underscore(name);
  let driverName = driver;
  let template = 'export default {\n';
  let username: string | undefined;

  if (!driverName) {
    driverName = 'sqlite3';
  }

  if (driverName === 'pg') {
    username = 'postgres';
  } else if (driverName !== 'pg' && driverName !== 'sqlite3') {
    username = 'root';
  }

  ['development', 'test', 'production'].forEach(environment => {
    template += `${indent(2)}${environment}: {\n`;

    if (driverName !== 'sqlite3') {
      template += `${indent(4)}pool: 5,\n`;
    }

    template += `${indent(4)}driver: '${driverName}',\n`;

    if (username) {
      template += `${indent(4)}username: '${username}',\n`;
    }

    // SQLite appends the environment itself (`db/blog_development.sqlite`);
    // a server database's name is used as is.
    if (driverName === 'sqlite3') {
      template += `${indent(4)}database: '${schemaName}'\n`;
    } else {
      template += `${indent(4)}database: '${schemaName}_${SUFFIXES[environment]}'\n`;
    }

    template += `${indent(2)}}`;

    if (environment !== 'production') {
      template += ',\n\n';
    }
  });

  template += '\n};\n';

  return template;
};
