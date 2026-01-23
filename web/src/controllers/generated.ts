// AUTO-GENERATED. Do not edit. Edit widgets/<type>/widget.* instead.
import type { WidgetFactory } from '../types';

import * as actions from './actions';
import * as agenda from './agenda';
import * as bar from './bar';
import * as clock from './clock';
import * as countdown from './countdown';
import * as donut from './donut';
import * as ev from './ev';
import * as feed from './feed';
import * as frame from './frame';
import * as gauge from './gauge';
import * as graph from './graph';
import * as hourly from './hourly';
import * as image from './image';
import * as inspect from './inspect';
import * as log from './log';
import * as metric from './metric';
import * as nest from './nest';
import * as progress from './progress';
import * as rss from './rss';
import * as spark from './spark';
import * as status from './status';
import * as stocks from './stocks';
import * as table from './table';
import * as text from './text';
import * as toggle from './toggle';
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
  'actions': resolveFactory(actions),
  'agenda': resolveFactory(agenda),
  'bar': resolveFactory(bar),
  'clock': resolveFactory(clock),
  'countdown': resolveFactory(countdown),
  'donut': resolveFactory(donut),
  'ev': resolveFactory(ev),
  'feed': resolveFactory(feed),
  'frame': resolveFactory(frame),
  'gauge': resolveFactory(gauge),
  'graph': resolveFactory(graph),
  'hourly': resolveFactory(hourly),
  'image': resolveFactory(image),
  'inspect': resolveFactory(inspect),
  'log': resolveFactory(log),
  'metric': resolveFactory(metric),
  'nest': resolveFactory(nest),
  'progress': resolveFactory(progress),
  'rss': resolveFactory(rss),
  'spark': resolveFactory(spark),
  'status': resolveFactory(status),
  'stocks': resolveFactory(stocks),
  'table': resolveFactory(table),
  'text': resolveFactory(text),
  'toggle': resolveFactory(toggle),
  'tomorrow': resolveFactory(tomorrow),
  'twitchstream': resolveFactory(twitchstream),
  'whispers': resolveFactory(whispers),
};

export default controllers;