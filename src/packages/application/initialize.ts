import { LUX_CONSOLE } from '../../constants';
import Database from '../database';
import Logger from '../logger';
import Router from '../router';
import Server from '../server';
import { build, createLoader, closestChild } from '../loader';
import { freezeProps, deepFreezeProps } from '../freezeable';
import ControllerMissingError from '../../errors/controller-missing-error';

import normalizePort from './utils/normalize-port';
import createController from './utils/create-controller';
import createSerializer from './utils/create-serializer';

import type Controller from '../controller';
import type Serializer from '../serializer';
import type { Model, ModelClass } from '../database';
import type Application from './index';
import type { Application$opts } from './index';

/**
 * @private
 */
export default async function initialize<T extends Application>(
  app: T,
  { path, port, logging, database, server: serverConfig }: Application$opts
): Promise<T> {
  const load = createLoader(path);
  const routes = load('routes');
  const models = load('models');
  const logger = new Logger(logging);
  const normalizedPort = normalizePort(port);

  const store = await new Database({
    path,
    models,
    logger,
    config: database,
    checkMigrations: true
  });

  const serializers = build<Serializer<Model>>(
    load('serializers'),
    (key, value, parent) =>
      createSerializer(value, {
        key,
        store,
        parent
      })
  );

  models.forEach((model: ModelClass) => {
    Reflect.defineProperty(model, 'serializer', {
      value: closestChild(serializers, model.resourceName),
      writable: false,
      enumerable: false,
      configurable: false
    });
  });

  const controllers = build<Controller>(
    load('controllers'),
    (key, value, parent) =>
      createController(value, {
        key,
        store,
        parent,
        serializers
      })
  );

  controllers.forEach((controller: Controller) => {
    Reflect.defineProperty(controller, 'controllers', {
      value: controllers,
      writable: true,
      enumerable: false,
      configurable: false
    });
  });

  const ApplicationController = controllers.get('application');

  if (!ApplicationController) {
    throw new ControllerMissingError('application');
  }

  const router = new Router({
    routes,
    controllers,
    controller: ApplicationController
  });

  const server = new Server({
    router,
    logger,
    ...serverConfig
  });

  if (!LUX_CONSOLE) {
    server.instance.listen(normalizedPort).once('listening', () => {
      if (typeof process.send === 'function') {
        process.send('ready');
      } else {
        // 'ready' is a custom lifecycle event, not one of Process's typed
        // emit overloads.
        (process as NodeJS.EventEmitter).emit('ready');
      }
    });
  }

  Object.assign(app, {
    logger,
    models,
    controllers,
    serializers
  });

  deepFreezeProps(app, true, 'logger', 'models', 'controllers', 'serializers');

  Object.assign(app, {
    path,
    store,
    router,
    server,
    port: normalizedPort
  });

  freezeProps(app, false, 'path', 'port', 'store', 'router', 'server');

  Object.freeze(app);

  return app;
}
