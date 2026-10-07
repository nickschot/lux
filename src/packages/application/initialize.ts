import { LUMEN_CONSOLE } from '../../constants';
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
import validateNamespacedSerializers from './utils/validate-namespaced-serializers';
import validateLinksOnly from './utils/validate-links-only';
import resolveVisibility from './utils/resolve-visibility';
import warnQueryParamNames from './utils/warn-query-param-names';

import type Controller from '../controller';
import type Serializer from '../serializer';
import type { Model, ModelClass } from '../database';
import type Application from './index';
import type { ApplicationOptions } from './index';

/**
 * @private
 */
export default async function initialize<T extends Application>(
  app: T,
  { path, port, logging, database, server: serverConfig }: ApplicationOptions
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

  // Lets a Serializer resolve related resources' Serializers in its own
  // namespace (`Serializer#serializerFor()`), as Controllers do.
  serializers.forEach((serializer: Serializer<Model>) => {
    Object.defineProperty(serializer, 'serializers', {
      value: serializers,
      writable: false,
      enumerable: false,
      configurable: false
    });
  });

  models.forEach((model: ModelClass) => {
    Object.defineProperty(model, 'serializer', {
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
    Object.defineProperty(controller, 'controllers', {
      value: controllers,
      writable: true,
      enumerable: false,
      configurable: false
    });
  });

  validateNamespacedSerializers(controllers, serializers);
  resolveVisibility(controllers, store.models.values());
  warnQueryParamNames(controllers, logger);

  const ApplicationController = controllers.get('application');

  if (!ApplicationController) {
    throw new ControllerMissingError('application');
  }

  const router = new Router({
    routes,
    controllers,
    controller: ApplicationController
  });

  // Against the routes as built: only a served related endpoint lets a
  // relationship be left without its linkage.
  validateLinksOnly(router, serializers);

  const server = new Server({
    router,
    logger,
    ...serverConfig
  });

  if (!LUMEN_CONSOLE) {
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
