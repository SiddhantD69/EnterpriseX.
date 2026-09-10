import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuthenticatedContext,
} from "./authenticated-context.js";

test("authenticated context contains trusted session identity and ERP authorization context", () => {
  const context: AuthenticatedContext = {
    sessionId: "session-1",

    user: {
      userId: "user-1",
      email: "user@enterprisex.local",
      displayName: "EnterpriseX User",
    },

    organization: {
      id: "organization-1",
      code: "ENTX",
      name: "EnterpriseX Organization",
    },

    company: {
      id: "company-1",
      code: "ENTX-CO",
      name: "EnterpriseX Company",
    },

    roles: [
      {
        id: "role-1",
        code: "ERP_ADMIN",
        name: "ERP Administrator",
      },
    ],

    permissions: [
      {
        code: "core.read",
        name: "Read Core Platform",
      },
    ],
  };

  assert.equal(
    context.sessionId,
    "session-1",
  );

  assert.equal(
    context.user.userId,
    "user-1",
  );

  assert.equal(
    context.organization.code,
    "ENTX",
  );

  assert.equal(
    context.company.code,
    "ENTX-CO",
  );

  assert.equal(
    context.roles[0].code,
    "ERP_ADMIN",
  );

  assert.equal(
    context.permissions[0].code,
    "core.read",
  );
});