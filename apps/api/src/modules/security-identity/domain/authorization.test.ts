import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuthenticatedContext,
} from "./authenticated-context.js";

import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "./authorization.js";

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
      code: "finance.invoice.read",
      name: "Read Finance Invoices",
    },
    {
      code: "finance.invoice.create",
      name: "Create Finance Invoices",
    },
    {
      code: "finance.invoice.approve",
      name: "Approve Finance Invoices",
    },
  ],
};

test("Authorization", async (t) => {
  await t.test(
    "allows an existing permission",
    () => {
      assert.equal(
        hasPermission(
          context,
          "finance.invoice.read",
        ),
        true,
      );
    },
  );

  await t.test(
    "denies a missing permission",
    () => {
      assert.equal(
        hasPermission(
          context,
          "finance.invoice.delete",
        ),
        false,
      );
    },
  );

  await t.test(
    "denies an empty permission code",
    () => {
      assert.equal(
        hasPermission(
          context,
          "",
        ),
        false,
      );

      assert.equal(
        hasPermission(
          context,
          "   ",
        ),
        false,
      );
    },
  );

  await t.test(
    "allows when any requested permission exists",
    () => {
      assert.equal(
        hasAnyPermission(
          context,
          [
            "finance.invoice.delete",
            "finance.invoice.read",
          ],
        ),
        true,
      );
    },
  );

  await t.test(
    "denies when none of the requested permissions exist",
    () => {
      assert.equal(
        hasAnyPermission(
          context,
          [
            "finance.invoice.delete",
            "finance.invoice.export",
          ],
        ),
        false,
      );
    },
  );

  await t.test(
    "allows when all requested permissions exist",
    () => {
      assert.equal(
        hasAllPermissions(
          context,
          [
            "finance.invoice.read",
            "finance.invoice.create",
          ],
        ),
        true,
      );
    },
  );

  await t.test(
    "denies when one required permission is missing",
    () => {
      assert.equal(
        hasAllPermissions(
          context,
          [
            "finance.invoice.read",
            "finance.invoice.delete",
          ],
        ),
        false,
      );
    },
  );

  await t.test(
    "allows an empty all-permissions requirement",
    () => {
      assert.equal(
        hasAllPermissions(
          context,
          [],
        ),
        true,
      );
    },
  );

  await t.test(
    "denies an empty any-permissions requirement",
    () => {
      assert.equal(
        hasAnyPermission(
          context,
          [],
        ),
        false,
      );
    },
  );
});