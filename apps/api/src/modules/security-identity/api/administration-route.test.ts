import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { verifyPassword } from "../security/password-hasher.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";

test("Identity administration enforces permissions and persists scoped users and roles safely", async () => {
  const fixture = await createMasterDataTestSession([
    "security.users.read",
    "security.users.create",
    "security.users.update",
    "security.roles.read",
    "security.roles.create",
    "security.roles.update",
    "security.user_roles.manage",
    "security.user_company_access.manage",
    "procurement.requisitions.read",
  ]);
  const deniedFixture = await createMasterDataTestSession([]);
  const app = buildApp();
  const suffix = randomUUID().slice(0, 8);
  const email = `admin-user-${suffix}@enterprisex.local`;
  const password = `User-Admin-Password-${suffix}!`;
  const roleCode = `TEST_ROLE_${suffix.toUpperCase()}`;
  let userId: string | null = null;
  let roleId: string | null = null;
  let customRoleId: string | null = null;
  let additionalCompanyId: string | null = null;
  let additionalOrganizationId: string | null = null;

  try {
    const noAuth = await app.inject({
      method: "GET",
      url: "/api/v1/security/users",
    });
    assert.equal(noAuth.statusCode, 401);

    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/security/users",
      headers: { authorization: `Bearer ${deniedFixture.token}` },
    });
    assert.equal(denied.statusCode, 403);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/security/users",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        email,
        displayName: "Purchasing Operator",
        password,
      },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().data.email, email);
    assert.equal("password" in created.json().data, false);
    assert.equal("passwordHash" in created.json().data, false);
    userId = created.json().data.id;

    const credential = await db.query<{ password_hash: string }>(
      `
        SELECT credentials.password_hash
        FROM security.user_credentials credentials
        WHERE credentials.user_id = $1
      `,
      [userId],
    );
    assert.equal(credential.rowCount, 1);
    assert.notEqual(credential.rows[0].password_hash, password);
    assert.equal(await verifyPassword(password, credential.rows[0].password_hash), true);

    const userList = await app.inject({
      method: "GET",
      url: "/api/v1/security/users",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.ok(userList.json().data.some((user: { id: string }) => user.id === userId));

    const role = await app.inject({
      method: "POST",
      url: "/api/v1/security/roles",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: roleCode,
        name: "Test Purchasing Role",
        description: "Temporary role for admin integration coverage.",
        permissionCodes: ["procurement.requisitions.read"],
      },
    });
    assert.equal(role.statusCode, 201);
    assert.deepEqual(role.json().data.permissionCodes, ["procurement.requisitions.read"]);
    roleId = role.json().data.id;

    const assignment = await app.inject({
      method: "PUT",
      url: `/api/v1/security/users/${userId}/roles/${roleId}`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { status: "ACTIVE" },
    });
    assert.equal(assignment.statusCode, 200);

    const roleList = await app.inject({
      method: "GET",
      url: `/api/v1/security/users/${userId}/roles`,
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(roleList.statusCode, 200);
    assert.equal(roleList.json().data[0].roleId, roleId);

    const crossCompanyRoleAssignment = await app.inject({
      method: "PUT",
      url: `/api/v1/security/users/${deniedFixture.userId}/roles/${roleId}`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { status: "ACTIVE" },
    });
    assert.equal(crossCompanyRoleAssignment.statusCode, 404);

    const crossCompanyAssignment = await db.query(
      `
        SELECT id
        FROM security.user_roles
        WHERE user_id = $1 AND company_id = $2 AND role_id = $3
      `,
      [deniedFixture.userId, fixture.companyId, roleId],
    );
    assert.equal(crossCompanyAssignment.rowCount, 0);

    const organization = await db.query<{ id: string }>(
      `
        INSERT INTO core.organizations (code, name, status)
        VALUES ($1, $2, 'ACTIVE')
        RETURNING id
      `,
      [`ADMIN-FOREIGN-ORG-${suffix}`, "Admin Access Scope Test Organization"],
    );
    additionalOrganizationId = organization.rows[0].id;
    const company = await db.query<{ id: string }>(
      `
        INSERT INTO core.companies (organization_id, code, name, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        RETURNING id
      `,
      [additionalOrganizationId, `ADMIN-FOREIGN-CO-${suffix}`, "Admin Access Scope Test Company"],
    );
    additionalCompanyId = company.rows[0].id;

    const crossOrganizationAccess = await app.inject({
      method: "POST",
      url: `/api/v1/security/users/${userId}/company-access`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { companyId: additionalCompanyId },
    });
    assert.equal(crossOrganizationAccess.statusCode, 404);
    assert.equal(crossOrganizationAccess.json().error, "COMPANY_NOT_FOUND");

    const crossCompanyUserUpdate = await app.inject({
      method: "PUT",
      url: `/api/v1/security/users/${deniedFixture.userId}`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        email: `foreign-user-update-${suffix}@enterprisex.local`,
        displayName: "Must Not Update",
        status: "INACTIVE",
      },
    });
    assert.equal(crossCompanyUserUpdate.statusCode, 404);

    const foreignUser = await db.query<{
      display_name: string;
      status: string;
    }>(
      "SELECT display_name, status FROM security.users WHERE id = $1",
      [deniedFixture.userId],
    );
    assert.equal(foreignUser.rows[0].display_name, "Master Data Test User");
    assert.equal(foreignUser.rows[0].status, "ACTIVE");

    const escalatedRole = await app.inject({
      method: "POST",
      url: "/api/v1/security/roles",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: `ESCALATED_ROLE_${suffix.toUpperCase()}`,
        name: "Unauthorized Permission Role",
        permissionCodes: ["core.audit.read"],
      },
    });
    assert.equal(escalatedRole.statusCode, 403);

    const escalatedUpdate = await app.inject({
      method: "PUT",
      url: `/api/v1/security/roles/${roleId}`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        name: "Test Purchasing Role",
        description: "Temporary role for admin integration coverage.",
        status: "ACTIVE",
        permissionCodes: ["core.audit.read"],
      },
    });
    assert.equal(escalatedUpdate.statusCode, 403);

    const customRole = await app.inject({
      method: "POST",
      url: "/api/v1/security/roles",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: `COMPANY_CUSTOM_${suffix.toUpperCase()}`,
        name: "Company Custom Role",
        description: "Company-scoped custom role.",
        permissionCodes: ["procurement.requisitions.read"],
      },
    });
    assert.equal(customRole.statusCode, 201);
    assert.equal(customRole.json().data.companyId, fixture.companyId);
    customRoleId = customRole.json().data.id;

    const foreignCustomRoleAssignment = await app.inject({
      method: "PUT",
      url: `/api/v1/security/users/${deniedFixture.userId}/roles/${customRoleId}`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { status: "ACTIVE" },
    });
    assert.equal(foreignCustomRoleAssignment.statusCode, 404);

    const updatedUser = await app.inject({
      method: "PUT",
      url: `/api/v1/security/users/${userId}`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        email,
        displayName: "Inactive Purchasing Operator",
        status: "INACTIVE",
      },
    });
    assert.equal(updatedUser.statusCode, 200);
    assert.equal(updatedUser.json().data.status, "INACTIVE");

    const audit = await db.query<{ action: string }>(
      `
        SELECT action
        FROM core.audit_events
        WHERE company_id = $1
          AND entity_id IN ($2, $3)
          AND action IN ('USER_CREATED', 'USER_UPDATED', 'ROLE_CREATED', 'USER_ROLE_UPDATED')
      `,
      [fixture.companyId, userId, roleId],
    );
    assert.equal(audit.rowCount, 4);
  } finally {
    if (userId || roleId) {
      await db.query(
        `
          DELETE FROM core.audit_events
          WHERE company_id = $1
            AND entity_id = ANY($2::uuid[])
        `,
        [fixture.companyId, [userId, roleId].filter((id): id is string => id !== null)],
      );
    }
    if (userId) {
      await db.query("DELETE FROM security.user_roles WHERE user_id = $1", [userId]);
      await db.query("DELETE FROM security.user_company_access WHERE user_id = $1", [userId]);
      await db.query("DELETE FROM security.user_credentials WHERE user_id = $1", [userId]);
      await db.query("DELETE FROM security.users WHERE id = $1", [userId]);
    }
    if (roleId) {
      await db.query("DELETE FROM security.role_permissions WHERE role_id = $1", [roleId]);
      await db.query("DELETE FROM security.roles WHERE id = $1", [roleId]);
    }
    if (customRoleId) {
      await db.query("DELETE FROM security.role_permissions WHERE role_id = $1", [customRoleId]);
      await db.query("DELETE FROM security.roles WHERE id = $1", [customRoleId]);
    }
    if (additionalCompanyId) {
      await db.query("DELETE FROM core.companies WHERE id = $1", [additionalCompanyId]);
    }
    if (additionalOrganizationId) {
      await db.query("DELETE FROM core.organizations WHERE id = $1", [additionalOrganizationId]);
    }

    try {
      await app.close();
    } finally {
      try {
        await fixture.cleanup();
      } finally {
        await deniedFixture.cleanup();
      }
    }
  }
});