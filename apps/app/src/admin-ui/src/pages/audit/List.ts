import { createStaticListModule } from "../../lib/pages";

const auditListModule = createStaticListModule({
  resourceId: "audit",
  title: "Audit Log",
  subtitle: "Review recent admin events and actions.",
});

export default auditListModule;
