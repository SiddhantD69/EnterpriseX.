import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../master-data/api/master-data-test-fixtures.js";

test("organization and company management endpoints enforce the authenticated organization and permission set", async () => {
  const app = buildApp();
  const session = await createMasterDataTestSession([
    "core.organization.read",
    "core.organizations.read",
    "core.organizations.create",
    "core.organizations.update",
    "core.companies.read",
    "core.companies.create",
    "core.companies.update",
  ]);
  const denied = await createMasterDataTestSession([]);
  const createdCompanyIds: string[] = [];

  try {
    const noAuth = await app.inject({
      method: "GET",
      url: "/api/v1/core/companies",
    });
    assert.equal(noAuth.statusCode, 401);

    const forbidden = await app.inject({
      method: "GET",
      url: "/api/v1/core/companies",
      headers: { authorization: `Bearer ${denied.token}` },
    });
    assert.equal(forbidden.statusCode, 403);

    const organization = await app.inject({
      method: "GET",
      url: "/api/v1/core/organizations",
      headers: { authorization: `Bearer ${session.token}` },
    });
    assert.equal(organization.statusCode, 200);
    assert.equal(organization.json().data.id, session.organizationId);

    const createdCompany = await app.inject({
      method: "POST",
      url: "/api/v1/core/companies",
      headers: { authorization: `Bearer ${session.token}` },
      payload: {
        code: `CORE-ORG-TEST-${Date.now().toString().slice(-6)}`,
        name: "Core Organization Company",
      },
    });
    assert.equal(createdCompany.statusCode, 201);
    assert.equal(createdCompany.json().data.organizationId, session.organizationId);
    const companyId = createdCompany.json().data.id;
    createdCompanyIds.push(companyId);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/core/companies",
      headers: { authorization: `Bearer ${session.token}` },
    });
    assert.equal(list.statusCode, 200);
    assert.ok(list.json().data.some((company: { id: string }) => company.id === companyId));

    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/core/companies/${companyId}`,
      headers: { authorization: `Bearer ${session.token}` },
      payload: {
        name: "Updated Core Organization Company",
        status: "INACTIVE",
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().data.name, "Updated Core Organization Company");
    assert.equal(updated.json().data.status, "INACTIVE");
  } finally {
    if (createdCompanyIds.length > 0) {
      await db.query(
        "DELETE FROM core.audit_events WHERE company_id = ANY($1::uuid[])",
        [createdCompanyIds],
      );
      await db.query(
        "DELETE FROM security.user_company_access WHERE company_id = ANY($1::uuid[])",
        [createdCompanyIds],
      );
      await db.query(
        "DELETE FROM core.companies WHERE id = ANY($1::uuid[])",
        [createdCompanyIds],
      );
    }

    await session.cleanup();
    await denied.cleanup();
    await app.close();
  }
});
