import type { Scenario } from "../schema";
import { saasStartup } from "./saas-startup";
import { restaurant } from "./restaurant";
import { retail } from "./retail";
import { ecommerce } from "./ecommerce";
import { wholesale } from "./wholesale";
import { services } from "./services";
import { marketplace } from "./marketplace";
import { manufacturing } from "./manufacturing";

export const TEMPLATES: Record<string, Scenario> = {
  "saas-startup": saasStartup,
  restaurant,
  retail,
  ecommerce,
  wholesale,
  services,
  marketplace,
  manufacturing,
};
