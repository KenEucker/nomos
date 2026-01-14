import { createStaticListModule } from "../../lib/pages";

const webhooksListModule = createStaticListModule({
  resourceId: "webhooks",
  title: "Webhooks",
  subtitle: "Inspect destinations and recent deliveries.",
});

export default webhooksListModule;
