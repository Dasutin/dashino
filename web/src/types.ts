export type StreamPayload = {
  widgetId?: string;
  type?: string;
  data?: unknown;
  at?: string;
};

export type WidgetPlacement = {
  id: string;
  type: string;
  title?: string;
  position?: {
    w?: number;
    h?: number;
    x?: number;
    y?: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    aspectRatio?: number;
  };
  stack?: StackWidgetConfig;
  instanceId?: string;
  instance?: WidgetInstance;
  instanceError?: string;
};

export const CONFIGURABLE_WIDGET_TYPES = ["rss", "image"] as const;
export type ConfigurableWidgetType = typeof CONFIGURABLE_WIDGET_TYPES[number];

export type Dashboard = {
  slug: string;
  name: string;
  description?: string;
  className?: string;
  theme?: string;
  maxColumns: number;
  gutter?: number;
  columnWidth?: number;
  rowHeight?: number;
  maxRows?: number;
  defaultWidgetSpan?: { w?: number; h?: number };
  widgets: WidgetPlacement[];
};

export type Playlist = {
  slug: string;
  name: string;
  rotationSeconds: number;
  dashboards: string[];
};

export type StackWidgetConfig = {
  slug: string;
  overrideIntervalMs?: number;
  mode?: 'cycle' | 'random' | string;
};

export type StackDefinition = {
  slug: string;
  name: string;
  intervalMs?: number;
  mode?: 'cycle' | 'random' | string;
  widgets: WidgetPlacement[];
};

export type WidgetTemplate = {
  type: string;
  html: string;
  css: string;
};

export type RssWidgetInstanceConfig = {
  title?: string;
  feeds: { name?: string; url: string }[];
  maxItems?: number;
  intervalMs?: number;
};

export type ImageWidgetInstanceConfig = {
  title?: string;
  images: { url: string; caption?: string; fit?: 'cover' | 'contain' }[];
};

type WidgetInstanceBase = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type WidgetInstance =
  | (WidgetInstanceBase & { type: 'rss'; config: RssWidgetInstanceConfig })
  | (WidgetInstanceBase & { type: 'image'; config: ImageWidgetInstanceConfig })
  | (WidgetInstanceBase & { type: string; config: Record<string, unknown> });

export type WidgetController = {
  update?: (payload?: StreamPayload) => void;
  resize?: (size: { width: number; height: number; dpr: number }) => void;
  destroy?: () => void;
};

export type WidgetFactory = (args: {
  root: HTMLElement;
  widget: WidgetPlacement;
  template?: WidgetTemplate;
}) => WidgetController;
