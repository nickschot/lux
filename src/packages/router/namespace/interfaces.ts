import type Controller from '../../controller';
import type { RouterNamespace } from '../index';

export type NamespaceOptions = {
  name: string;
  path: string;
  namespace?: RouterNamespace;
  controller: Controller;
  controllers: Map<string, Controller>;
};
