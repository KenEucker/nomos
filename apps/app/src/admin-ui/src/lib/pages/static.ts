import type { ListPageModule, ListQueryResult, PageAction, PageBreadcrumb } from "./types";

interface StaticListModuleOptions {
  resourceId: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: PageBreadcrumb[];
  pageActions?: PageAction[];
}

const emptyListResult: ListQueryResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 1,
};

export function createStaticListModule({
  resourceId,
  title,
  subtitle,
  breadcrumbs,
  pageActions,
}: StaticListModuleOptions): ListPageModule {
  return {
    resourceId,
    view: "List",
    title,
    subtitle,
    breadcrumbs,
    pageActions,
    query: {
      list: async () => emptyListResult,
    },
    list: {
      columns: [],
    },
  };
}
