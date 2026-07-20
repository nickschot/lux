import { createDefaultConfig } from '../config';
import merge from '../../utils/merge';
import type Logger from '../logger';
import type Router from '../router';
import type Server from '../server';
import type Controller from '../controller';
import type Serializer from '../serializer';
import type Database from '../database';
import type { Model, ModelClass } from '../database';
import type { FreezeableMap } from '../freezeable';

import initialize from './initialize';
import type { Application$opts } from './interfaces';

/**
 * @class Application
 * @public
 */
class Application {
  /**
   * The path of `Application` instance.
   *
   * @property path
   * @type {String}
   * @public
   */
  declare path: string;

  /**
   * The port that an `Application` instance is listening for incomming HTTP
   * requests.
   *
   * @property port
   * @type {Number}
   * @public
   */
  declare port: number;

  /**
   * A reference to the `Database` instance.
   *
   * @property store
   * @type {Database}
   * @private
   */
  declare store: Database;

  /**
   * A reference to the `Logger` instance.
   *
   * @property logger
   * @type {Logger}
   * @private
   */
  declare logger: Logger;

  /**
   * A reference to the `Router` instance.
   *
   * @property router
   * @type {Router}
   * @private
   */
  declare router: Router;

  /**
   * A reference to the `Server` instance.
   *
   * @property server
   * @type {Server}
   * @private
   */
  declare server: Server;

  /**
   * A map containing each `Model` class.
   *
   * @property models
   * @type {Map}
   * @private
   */
  declare models: FreezeableMap<string, ModelClass>;

  /**
   * A map containing each `Controller` instance.
   *
   * @property controllers
   * @type {Map}
   * @private
   */
  declare controllers: FreezeableMap<string, Controller>;

  /**
   * A map containing each `Serializer` instance.
   *
   * @property serializers
   * @type {Map}
   * @private
   */
  declare serializers: FreezeableMap<string, Serializer<Model>>;

  /**
   * @method constructor
   * @param {Object} config
   * @return {Promise}
   * @public
   */
  constructor(opts: Application$opts) {
    // Applications construct asynchronously (see Database/Watcher); `new
    // Application()` resolves to the ready instance, and TS cannot type a
    // Promise-returning constructor.
    return initialize(
      this,
      merge(createDefaultConfig(), opts)
    ) as unknown as Application;
  }
}

export default Application;
export type {
  Application$opts,
  Application$Class,
  Application$factoryOpts
} from './interfaces';
