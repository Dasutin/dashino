// AUTO-GENERATED. Do not edit. Edit widgets/<type>/widget.* instead.
import type { WidgetFactory } from '../types';

import * as clock from './clock';
import * as ev from './ev';
import * as graph from './graph';
import * as hourly from './hourly';
import * as message from './message';
import * as metric from './metric';
import * as nest from './nest';
import * as stocks from './stocks';
import * as tomorrow from './tomorrow';
import * as twitchstream from './twitchstream';
import * as whispers from './whispers';

function resolveFactory(mod: any): WidgetFactory | undefined {
  if (typeof mod.createController === 'function') return mod.createController;
  if (typeof mod.default === 'function') return mod.default;
  const key = Object.keys(mod).find(k => /^create.+Controller$/.test(k));
  if (key && typeof mod[key] === "function") return mod[key] as WidgetFactory;
  return undefined;
}

const controllers: Record<string, WidgetFactory> = {
  'clock': resolveFactory(clock),
  'ev': resolveFactory(ev),
  'graph': resolveFactory(graph),
  'hourly': resolveFactory(hourly),
  'message': resolveFactory(message),
  'metric': resolveFactory(metric),
  'nest': resolveFactory(nest),
  'stocks': resolveFactory(stocks),
  'tomorrow': resolveFactory(tomorrow),
  'twitchstream': resolveFactory(twitchstream),
  'whispers': resolveFactory(whispers),
};

export default controllers;