import { createStaticListModule } from "../../lib/pages";

const loginListModule = createStaticListModule({
  resourceId: "login",
  title: "Admin Login",
  subtitle: "Sign in to manage Nomos.",
});

export default loginListModule;
