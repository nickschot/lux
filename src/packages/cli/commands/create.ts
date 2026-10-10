import { EOL } from 'os';

import chalk from '../../../utils/chalk';
import { CWD } from '../../../constants';
import { mkdir, writeFile } from '../../fs';
import template from '../../template';
import exec from '../../../utils/exec';
import driverFor from '../utils/driver-for';
import createSpinner from '../utils/create-spinner';
import appTemplate from '../templates/application';
import configTemplate from '../templates/config';
import routesTemplate from '../templates/routes';
import dbTemplate from '../templates/database';
import seedTemplate from '../templates/seed';
import pkgJSONTemplate from '../templates/package-json';
import pnpmWorkspaceTemplate from '../templates/pnpm-workspace';
import eslintConfigTemplate from '../templates/eslint-config';
import readmeTemplate from '../templates/readme';
import licenseTemplate from '../templates/license';
import gitignoreTemplate from '../templates/gitignore';

import { generate } from './generate';

/**
 * @private
 */
export async function create(name: string, database: string) {
  const driver = driverFor(database);
  const project = `${CWD}/${name}`;

  await mkdir(project);

  await Promise.all([
    mkdir(`${project}/app`),
    mkdir(`${project}/config`),
    mkdir(`${project}/db`)
  ]);

  await Promise.all([
    mkdir(`${project}/app/models`),
    mkdir(`${project}/app/serializers`),
    mkdir(`${project}/app/controllers`),
    mkdir(`${project}/app/middleware`),
    mkdir(`${project}/app/utils`),
    mkdir(`${project}/config/environments`),
    mkdir(`${project}/db/migrate`)
  ]);

  await Promise.all([
    writeFile(`${project}/app/index.js`, appTemplate(name)),

    writeFile(`${project}/app/routes.js`, routesTemplate()),

    writeFile(
      `${project}/config/environments/development.js`,
      configTemplate(name, 'development')
    ),

    writeFile(
      `${project}/config/environments/test.js`,
      configTemplate(name, 'test')
    ),

    writeFile(
      `${project}/config/environments/production.js`,
      configTemplate(name, 'production')
    ),

    writeFile(`${project}/config/database.js`, dbTemplate(name, driver)),

    writeFile(`${project}/db/seed.js`, seedTemplate()),

    writeFile(`${project}/README.md`, readmeTemplate(name)),

    writeFile(`${project}/LICENSE`, licenseTemplate()),

    writeFile(`${project}/package.json`, pkgJSONTemplate(name, driver)),

    writeFile(`${project}/eslint.config.mjs`, eslintConfigTemplate()),

    writeFile(`${project}/.gitignore`, gitignoreTemplate()),

    writeFile(`${project}/pnpm-workspace.yaml`, pnpmWorkspaceTemplate(driver))
  ]);

  const logOutput = template`
    ${chalk.green('create')} app/index.js
    ${chalk.green('create')} app/routes.js
    ${chalk.green('create')} config/environments/development.js
    ${chalk.green('create')} config/environments/test.js
    ${chalk.green('create')} config/environments/production.js
    ${chalk.green('create')} config/database.js
    ${chalk.green('create')} db/migrate
    ${chalk.green('create')} db/seed.js
    ${chalk.green('create')} README.md
    ${chalk.green('create')} LICENSE
    ${chalk.green('create')} package.json
    ${chalk.green('create')} eslint.config.mjs
    ${chalk.green('create')} .gitignore
    ${chalk.green('create')} pnpm-workspace.yaml
  `;

  process.stdout.write(logOutput.substr(0, logOutput.length - 1));
  process.stdout.write(EOL);

  await Promise.all([
    generate({
      cwd: project,
      type: 'serializer',
      name: 'application'
    }),

    generate({
      cwd: project,
      type: 'controller',
      name: 'application'
    })
  ]);

  await exec('git init && git add .', {
    cwd: project
  });

  process.stdout.write(`${chalk.green('initialize')} git`);
  process.stdout.write(EOL);

  const spinner = createSpinner('Installing dependencies from npm...');

  spinner.start();

  // The database driver is already declared in the generated package.json, so a
  // plain install pulls it in — no separate `npm install --save` needed.
  await exec('npm install', {
    cwd: project
  });

  spinner.stop();
}
