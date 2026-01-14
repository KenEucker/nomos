import { createStaticListModule } from "../../lib/pages";

const docsListModule = createStaticListModule({
  resourceId: "docs",
  title: "API Documentation",
  subtitle: "Browse the OpenAPI reference for Nomos.",
});

export default docsListModule;
