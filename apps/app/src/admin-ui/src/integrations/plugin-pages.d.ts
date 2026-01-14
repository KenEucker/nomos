export type PluginPageRoute = {
  route: string;
  entrypoint: string;
  sourceLabel: string;
  filePath: string;
  pagesDir?: string;
  pluginName?: string;
};

export type PluginPagesSummary = {
  routes: PluginPageRoute[];
  pluginPages: Array<{ pluginName: string; pagesDir: string }>;
  pluginBaseDir: string;
  adminUiRoot: string;
};

export type CorePagesSummary = {
  routes: PluginPageRoute[];
  corePagesDir: string;
  adminUiRoot: string;
};

export const getPluginPageRoutes: (options?: {
  adminUiRoot?: string;
}) => Promise<PluginPagesSummary>;

export const getCorePageRoutes: (options?: {
  adminUiRoot?: string;
}) => Promise<CorePagesSummary>;

export const pluginPages: () => unknown;

export const resolveAdminUiPaths: (adminUiRoot: string) => {
  adminUiRoot: string;
  pluginBaseDir: string;
  corePagesDir: string;
};
