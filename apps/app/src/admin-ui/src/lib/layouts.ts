import type {
  BarChartNode,
  CardNode,
  ColumnsNode,
  FieldsetNode,
  FormNode,
  HeaderNode,
  IframeNode,
  LineChartNode,
  LayoutNode,
  ModalNode,
  PieChartNode,
  RowsNode,
  StatNode,
  TableNode,
  TabsNode,
  TextNode,
} from "./types"

export const Layouts = {
  rows: (nodes: LayoutNode[]): RowsNode => ({
    type: "rows",
    props: { nodes },
  }),

  columns: (columns: ColumnsNode["props"]["columns"]): ColumnsNode => ({
    type: "columns",
    props: { columns },
  }),

  card: (props: CardNode["props"]): CardNode => ({
    type: "card",
    props,
  }),

  table: (props: TableNode["props"]): TableNode => ({
    type: "table",
    props,
  }),

  fieldset: (props: FieldsetNode["props"]): FieldsetNode => ({
    type: "fieldset",
    props,
  }),

  form: (props: FormNode["props"]): FormNode => ({
    type: "form",
    props,
  }),

  text: (props: TextNode["props"]): TextNode => ({
    type: "text",
    props,
  }),

  stat: (props: StatNode["props"]): StatNode => ({
    type: "stat",
    props,
  }),

  header: (props: HeaderNode["props"]): HeaderNode => ({
    type: "header",
    props,
  }),

  iframe: (props: IframeNode["props"]): IframeNode => ({
    type: "iframe",
    props,
  }),

  tabs: (props: TabsNode["props"]): TabsNode => ({
    type: "tabs",
    props,
  }),

  modal: (props: ModalNode["props"]): ModalNode => ({
    type: "modal",
    props,
  }),

  lineChart: (props: LineChartNode["props"]): LineChartNode => ({
    type: "lineChart",
    props,
  }),

  barChart: (props: BarChartNode["props"]): BarChartNode => ({
    type: "barChart",
    props,
  }),

  pieChart: (props: PieChartNode["props"]): PieChartNode => ({
    type: "pieChart",
    props,
  }),
}
