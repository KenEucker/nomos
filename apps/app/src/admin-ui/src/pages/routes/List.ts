import { createStaticListModule } from "../../lib/pages";

const routesListModule = createStaticListModule({
  resourceId: "routes",
  title: "Routes",
  subtitle: "Inspect registered route handlers and metadata.",
});

export default routesListModule;
