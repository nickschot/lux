import type Route from './route';
import type Controller from '../controller';
import type { FreezeableSet } from '../freezeable';

export type RouterOptions = {
  controller: Controller;
  controllers: Map<string, Controller>;

  routes(): void;
};

type RouterNamespaceEntry = Route | RouterNamespace;

export interface RouterNamespace extends FreezeableSet<RouterNamespaceEntry> {
  name: string;
  path: string;
  isRoot: boolean;
  namespace: RouterNamespace;
  controller: Controller;
  controllers: Map<string, Controller>;
}
