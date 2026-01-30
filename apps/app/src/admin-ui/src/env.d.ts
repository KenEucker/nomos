import type { ClientAuthPayload } from "./lib/authz/types";

declare global {
  namespace App {
    interface Locals {
      auth?: ClientAuthPayload;
    }
  }
}
