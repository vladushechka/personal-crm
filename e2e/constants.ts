import { tmpdir } from "node:os";
import { join } from "node:path";

// End-to-end tests run against a separate database, so real contacts are never touched
export const E2E_DATABASE = "personal_crm_e2e";
export const E2E_CONTACT_COUNT = 1000;
export const E2E_PORT = 3100;

// Everything the app server prints during the tests: they check what ends up in the log
export const E2E_SERVER_LOG = join(tmpdir(), "personal-crm-e2e-server.log");
