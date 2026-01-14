import { createStaticListModule } from "../../lib/pages";

const errorsListModule = createStaticListModule({
  resourceId: "errors",
  title: "Errors",
  subtitle: "Review recent error reports and stack traces.",
});

export default errorsListModule;
