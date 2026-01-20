import type { ClientAuthPayload } from "./lib/authz/types";

declare namespace App {
  interface Locals {
    auth?: ClientAuthPayload;
  }
}
