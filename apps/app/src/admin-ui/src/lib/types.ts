import type { JSONSchema7 } from "json-schema"

export type FilterValue = string | number | boolean | string[]

export type QueryState = {
  page: number
  pageSize: number
  search?: string
  sort?: { key: string; dir: "asc" | "desc" }
  filters?: Record<string, FilterValue>
}

export type PanelCtx = {
  url: string
  params: Record<string, string>
  query: Record<string, string | string[]>
  state: QueryState
  request?: Request
}

export type LinkAction = {
  type: "link"
  label: string
  href: string
  icon?: string
  intent?: string
}

export type MethodAction = {
  type: "method"
  label: string
  endpoint: string
  method?: "POST" | "PUT" | "PATCH" | "DELETE"
  payload?: (ctx: PanelCtx, data: Record<string, any>) => Record<string, any>
  confirm?: { title: string; body?: string }
  after?: "navigate" | "refresh" | "stay"
  redirectTo?: string
  toast?: { success?: string; error?: string }
  intent?: string
}

export type ModalOpenAction = {
  type: "modal.open"
  label: string
  modalId: string
  props?: Record<string, unknown>
  intent?: string
}

export type ModalCloseAction = {
  type: "modal.close"
  label?: string
  modalId?: string
  intent?: string
}

export type ActionDescriptor = LinkAction | MethodAction | ModalOpenAction | ModalCloseAction

export type ColumnDef = {
  key: string
  label: string
  sortable?: boolean
  render?: "text" | "badge" | "date" | "datetime" | "boolean" | "json" | "link" | "email" | "action"
  badgeVariants?: Record<string, string>
  linkTemplate?: string
  width?: string
  hideOnMobile?: boolean
}

export type RowAction = {
  id: string
  label: string
  variant?: "default" | "secondary" | "ghost" | "destructive"
  intent?: string
  type?: "link" | "method" | "conditionalLink"
  href?: string
  /** For conditionalLink: key to check on row (e.g. "lastPreview"); if falsy, show toast instead of navigating */
  checkKey?: string
  /** For conditionalLink: toast message when check fails */
  toastIfMissing?: string
  endpoint?: string
  method?: "POST" | "PUT" | "PATCH" | "DELETE"
  /** Request body for method actions. Use a plain object so it survives SSR (e.g. { action: "rotate" }). */
  payload?: Record<string, unknown> | ((row: Record<string, any>) => Record<string, unknown>)
  confirm?: { title: string; body?: string }
  after?: "refresh" | "navigate"
  toast?: { success?: string; error?: string }
  showWhen?: {
    key: string
    equals?: string | number | boolean
    notEquals?: string | number | boolean
    in?: Array<string | number | boolean>
    truthy?: boolean
    falsy?: boolean
  }
}

export type FieldDef = {
  name: string
  label: string
  type:
    | "text"
    | "textarea"
    | "email"
    | "password"
    | "number"
    | "checkbox"
    | "select"
    | "multiselect"
    | "date"
    | "datetime"
  placeholder?: string
  helperText?: string
  help?: string
  options?: Array<{ value: string; label: string }>
  optionsEndpoint?: string
  optionsKey?: string
  valueKey?: string
  labelKey?: string
  required?: boolean
  readonly?: boolean
  showOnCreate?: boolean
  showOnEdit?: boolean
  showOnView?: boolean
  transform?: "lines" | "csv"
  /** Regular expression pattern for validation (e.g. URL format). Applied when value is non-empty. */
  pattern?: string
  /** Error message when pattern does not match. */
  patternMessage?: string
}

export type RowsNode = {
  type: "rows"
  props: {
    nodes: LayoutNode[]
    requiredIntent?: string
  }
}

export type ColumnsNode = {
  type: "columns"
  props: {
    columns: Array<{ span?: number; nodes: LayoutNode[] }>
    requiredIntent?: string
  }
}

export type CardNode = {
  type: "card"
  props: {
    title?: string
    description?: string
    nodes: LayoutNode[]
    requiredIntent?: string
  }
}

export type TableFilterDef = {
  key: string
  label: string
  type?: "text" | "select"
  options?: Array<{ value: string; label: string }>
}

export type TableNode = {
  type: "table"
  props: {
    key: string
    title?: string
    description?: string
    rowsKey: string
    columns: ColumnDef[]
    paginationKey?: string
    serverSide?: boolean
    rowIdKey?: string
    enableEdit?: boolean
    editIntent?: string
    saveEndpoint?: string
    saveMethod?: "POST" | "PUT" | "PATCH"
    searchable?: boolean
    searchPlaceholder?: string
    sortable?: boolean
    defaultSort?: { key: string; dir: "asc" | "desc" }
    filters?: TableFilterDef[]
    columnVisibility?: boolean
    bulkActions?: ActionDescriptor[]
    rowActions?: RowAction[]
    rowActionBasePath?: string
    rowActionDeleteEndpoint?: string
    requiredIntent?: string
  }
}

export type FieldsetNode = {
  type: "fieldset"
  props: {
    title?: string
    nodes: LayoutNode[]
    requiredIntent?: string
  }
}

export type FormNode = {
  type: "form"
  props: {
    id: string
    title?: string
    description?: string
    schema?: JSONSchema7
    fields: FieldDef[]
    submitLabel?: string
    submitEndpoint: string
    submitMethod?: "POST" | "PUT" | "PATCH"
    initialValuesKey?: string
    after?: "refresh" | "navigate"
    redirectTo?: string
    requiredIntent?: string
  }
}

export type TextNode = {
  type: "text"
  props: {
    value?: string
    valueKey?: string
    requiredIntent?: string
  }
}

export type StatNode = {
  type: "stat"
  props: {
    label: string
    valueKey: string
    requiredIntent?: string
  }
}

export type HeaderNode = {
  type: "header"
  props: {
    title: string
    subtitle?: string
    requiredIntent?: string
  }
}

export type IframeNode = {
  type: "iframe"
  props: {
    src: string
    title: string
    height?: string
    requiredIntent?: string
  }
}

export type TabsNode = {
  type: "tabs"
  props: {
    tabs: Array<{ label: string; nodes: LayoutNode[] }>
    defaultTab?: number
    requiredIntent?: string
  }
}

export type ModalNode = {
  type: "modal"
  props: {
    id: string
    title?: string
    nodes: LayoutNode[]
    requiredIntent?: string
  }
}

export type LineChartNode = {
  type: "lineChart"
  props: {
    dataKey: string
    xKey: string
    yKey: string
    seriesKey?: string
    title?: string
    description?: string
    requiredIntent?: string
  }
}

export type BarChartNode = {
  type: "barChart"
  props: {
    dataKey: string
    xKey: string
    yKey: string
    seriesKey?: string
    title?: string
    description?: string
    requiredIntent?: string
  }
}

export type PieChartNode = {
  type: "pieChart"
  props: {
    dataKey: string
    categoryKey: string
    valueKey: string
    title?: string
    description?: string
    requiredIntent?: string
  }
}

export type ChartNode = LineChartNode | BarChartNode | PieChartNode

export type LayoutNode =
  | RowsNode
  | ColumnsNode
  | CardNode
  | TableNode
  | FieldsetNode
  | TextNode
  | StatNode
  | HeaderNode
  | FormNode
  | IframeNode
  | TabsNode
  | ModalNode
  | LineChartNode
  | BarChartNode
  | PieChartNode

export type PanelModule = {
  id: string
  title: string
  subtitle?: string
  menu?: {
    label?: string
    icon?: string
    order?: number
    group?: string
  }
  query: (ctx: PanelCtx) => Promise<Record<string, any>> | Record<string, any>
  layout: (data: Record<string, any>, ctx: PanelCtx) => LayoutNode[]
  commandBar: (ctx: PanelCtx, data: Record<string, any>) => ActionDescriptor[]
}

export type ResourceEndpointValue = string | true

export type ResourceEndpoints = {
  list?: string
  get?: string
  create?: string
  update?: string
  delete?: string
  /** Optional bulk delete endpoint (e.g. POST /resource/bulk-delete with body { ids }) */
  bulkDelete?: string
}

export type ResourceLabels =
  | {
      label?: string
      labelPlural?: string
      labels?: never
    }
  | {
      label?: never
      labelPlural?: never
      labels: {
        label: string
        labelPlural: string
      }
    }

export type ResourceMenu = {
  group?: string
  order?: number
  icon?: string
}

export type ResourceListConfig = {
  columns?: ColumnDef[]
  /** Key for row identity (default "id"). Use "slug" for slug-based resources like plugins. */
  rowIdKey?: string
  rowActions?: {
    view?: boolean
    edit?: boolean
    delete?: boolean
  }
  customRowActions?: RowAction[]
  defaultSort?: {
    key: string
    direction: "asc" | "desc"
  }
  sortable?: boolean
  filters?: TableFilterDef[]
  columnVisibility?: boolean
  bulkActions?: ActionDescriptor[]
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
  serverSide?: boolean
}

export type ResourceFormConfig = {
  fields?: FieldDef[]
}

export type ResourceDefinition = ResourceLabels & {
  name: string
  endpoints: ResourceEndpoints
  menu?: ResourceMenu
  list?: ResourceListConfig
  form?: ResourceFormConfig
  // Admin resource schemas are JSON Schema; backend will later use Zod for API/db contracts.
  schema?: JSONSchema7
  requiredPermission?: string
  intents?: {
    read?: string
    create?: string
    update?: string
    delete?: string
  }
  dataKey?: string
  singleDataKey?: string
}

export type ResourceDefinitionPartial = Partial<Omit<ResourceDefinition, "name" | "endpoints">> & {
  name: string
  endpoints?: Partial<Record<keyof ResourceEndpoints, ResourceEndpointValue>>
}
