import type { FSWatcher } from 'fs';
import type { Client } from 'fb-watchman';

export type WatcherClient = Client | FSWatcher;
