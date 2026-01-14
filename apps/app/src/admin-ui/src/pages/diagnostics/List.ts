import { createStaticListModule } from "../../lib/pages";

const diagnosticsListModule = createStaticListModule({
  resourceId: "diagnostics",
  title: "Diagnostics",
  subtitle: "Inspect runtime health and system status.",
});

export default diagnosticsListModule;
