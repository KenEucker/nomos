import { createStaticListModule } from "../../lib/pages";

const jobsListModule = createStaticListModule({
  resourceId: "jobs",
  title: "Jobs",
  subtitle: "Monitor scheduled work and job runs.",
});

export default jobsListModule;
