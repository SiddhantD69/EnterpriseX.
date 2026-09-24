import test from "node:test";
import assert from "node:assert/strict";

import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from "./authorization.js";

import type {
  AuthenticatedContext,
} from "./authenticated-context.js";

const createContext = (
  permissionCodes: string[],
): AuthenticatedContext => {
  return {
    sessionId:
      "00000000-0000-0000-0000-000000000004",

    user: {
      userId:
        "00000000-0000-0000-0000-000000000001",
      email:
        "developer@enterprisex.local",
      displayName:
        "EnterpriseX Developer",
    },

    organization: {
      id:
        "00000000-0000-0000-0000-000000000002",
      code: "ENTERPRISEX",
      name: "EnterpriseX",
    },

    company: {
      id:
        "00000000-0000-0000-0000-000000000003",
      code: "ENTERPRISEX-TEST",
      name: "EnterpriseX Test Company",
    },

    roles: [],

    permissions: permissionCodes.map(
      (code) => ({
        id: code,
        code,
        name: code,
      }),
    ),
  };
};

test(
  "hasPermission returns true for an assigned permission",
  () => {
    const context = createContext([
      "core.audit.read",
    ]);

    assert.equal(
      hasPermission(
        context,
        "core.audit.read",
      ),
      true,
    );
  },
);

test(
  "hasPermission returns false for an unassigned permission",
  () => {
    const context = createContext([
      "core.audit.read",
    ]);

    assert.equal(
      hasPermission(
        context,
        "core.audit.write",
      ),
      false,
    );
  },
);

test(
  "hasPermission returns false for an empty permission code",
  () => {
    const context = createContext([
      "core.audit.read",
    ]);

    assert.equal(
      hasPermission(context, ""),
      false,
    );

    assert.equal(
      hasPermission(context, "   "),
      false,
    );
  },
);

test(
  "hasAnyPermission returns true when at least one permission exists",
  () => {
    const context = createContext([
      "core.audit.read",
    ]);

    assert.equal(
      hasAnyPermission(context, [
        "core.audit.write",
        "core.audit.read",
      ]),
      true,
    );
  },
);

test(
  "hasAnyPermission returns false when no permission exists",
  () => {
    const context = createContext([
      "core.audit.read",
    ]);

    assert.equal(
      hasAnyPermission(context, [
        "core.configuration.read",
        "core.configuration.write",
      ]),
      false,
    );
  },
);

test(
  "hasAllPermissions returns true when all permissions exist",
  () => {
    const context = createContext([
      "core.audit.read",
      "core.audit.write",
    ]);

    assert.equal(
      hasAllPermissions(context, [
        "core.audit.read",
        "core.audit.write",
      ]),
      true,
    );
  },
);

test(
  "hasAllPermissions returns false when one permission is missing",
  () => {
    const context = createContext([
      "core.audit.read",
    ]);

    assert.equal(
      hasAllPermissions(context, [
        "core.audit.read",
        "core.audit.write",
      ]),
      false,
    );
  },
);

test(
  "hasAllPermissions returns true for an empty permission list",
  () => {
    const context = createContext([]);

    assert.equal(
      hasAllPermissions(context, []),
      true,
    );
  },
);