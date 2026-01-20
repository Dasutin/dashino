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
  position?: { w?: number; h?: number; x?: number; y?: number };
};

export type Dashboard = {
  slug: string;
  name: string;
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

export type WidgetTemplate = {
  type: string;
  html: string;
  css: string;
};

export type WidgetController = {
  update?: (payload?: StreamPayload) => void;
  destroy?: () => void;
};

export type WidgetFactory = (args: {
  root: HTMLElement;
  widget: WidgetPlacement;
  template?: WidgetTemplate;
}) => WidgetController;
