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
};

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
