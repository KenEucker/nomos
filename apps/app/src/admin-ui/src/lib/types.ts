import type { JSONSchema7 } from "json-schema"

export type QueryState = {
  page: number
  pageSize: number
  search?: string
  sort?: { key: string; dir: "asc" | "desc" }
}

export type PanelCtx = {
  url: string
  params: Record<string, string>
  query: Record<string, string | string[]>
  state: QueryState
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
  after?: "refresh" | "navigate"
  toast?: { success?: string; error?: string }
  intent?: string
}

export type ActionDescriptor = LinkAction | MethodAction

export type ColumnDef = {
  key: string
  label: string
  sortable?: boolean
  render?: "text" | "badge" | "date" | "datetime" | "boolean" | "json" | "link" | "email"
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
  type?: "link" | "method"
  href?: string
  endpoint?: string
  method?: "POST" | "PUT" | "PATCH" | "DELETE"
  confirm?: { title: string; body?: string }
  after?: "refresh" | "navigate"
  toast?: { success?: string; error?: string }
  showWhen?: {
    key: string
    equals?: string | number | boolean
    notEquals?: string | number | boolean
    truthy?: boolean
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

export type PanelModule = {
  id: string
  title: string
  subtitle?: string
  query: (ctx: PanelCtx) => Promise<Record<string, any>> | Record<string, any>
  layout: (data: Record<string, any>, ctx: PanelCtx) => LayoutNode[]
  commandBar: (ctx: PanelCtx, data: Record<string, any>) => ActionDescriptor[]
}

export type ResourceEndpoints = {
  list: string
  get: string
  create: string
  update: string
  delete: string
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
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
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
  endpoints: ResourceEndpoints
}
