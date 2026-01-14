import { createStaticListModule } from "../../lib/pages";

const dashboardListModule = createStaticListModule({
  resourceId: "dashboard",
  title: "Dashboard",
  subtitle: "Overview of system activity.",
});

export default dashboardListModule;
