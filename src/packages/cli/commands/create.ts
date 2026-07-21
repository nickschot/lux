import { EOL } from 'os';

import Ora from 'ora';
import { green } from 'chalk';

import { CWD } from '../../../constants';
import { mkdir, writeFile } from '../../fs';
import template from '../../template';
import exec from '../../../utils/exec';
import driverFor from '../utils/driver-for';
import appTemplate from '../templates/application';
import configTemplate from '../templates/config';
import routesTemplate from '../templates/routes';
import dbTemplate from '../templates/database';
import seedTemplate from '../templates/seed';
import pkgJSONTemplate from '../templates/package-json';
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

    writeFile(`${project}/.gitignore`, gitignoreTemplate())
  ]);

  const logOutput = template`
    ${green('create')} app/index.js
    ${green('create')} app/routes.js
    ${green('create')} bin/app.js
    ${green('create')} config/environments/development.js
    ${green('create')} config/environments/test.js
    ${green('create')} config/environments/production.js
    ${green('create')} config/database.js
    ${green('create')} db/migrate
    ${green('create')} db/seed.js
    ${green('create')} README.md
    ${green('create')} LICENSE
    ${green('create')} package.json
    ${green('create')} eslint.config.mjs
    ${green('create')} .gitignore
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

  process.stdout.write(`${green('initialize')} git`);
  process.stdout.write(EOL);

  const spinner = new Ora({
    text: 'Installing dependencies from npm...',
    spinner: 'dots'
  });

  spinner.start();

  // The database driver is already declared in the generated package.json, so a
  // plain install pulls it in — no separate `npm install --save` needed.
  await exec('npm install', {
    cwd: project
  });

  spinner.stop();
}
