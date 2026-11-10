import { tmpdir } from "node:os";
import { join } from "node:path";

// End-to-end tests run against a separate database, so real contacts are never touched
export const E2E_DATABASE = "personal_crm_e2e";
// Owner of the 1000 fake contacts: the tests sign in as this user
export const E2E_OWNER_EMAIL = "owner@e2e.test";
// The owner signed in: cookies the tests start with (global-setup.ts), not in git
export const E2E_STORAGE_STATE = "e2e/.auth/owner.json";
export const E2E_CONTACT_COUNT = 1000;
export const E2E_PORT = 3100;

// Everything the app server prints during the tests: they check what ends up in the log
export const E2E_SERVER_LOG = join(tmpdir(), "personal-crm-e2e-server.log");
