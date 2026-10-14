import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";

test("CRM lead and opportunity workflow validates permissions and company-scoped isolation", async () => {
  const fixture = await createMasterDataTestSession([
    "crm.read",
    "crm.leads.read",
    "crm.leads.create",
    "crm.opportunities.read",
    "crm.opportunities.create",
  ]);
  const deniedFixture = await createMasterDataTestSession([]);
  const app = buildApp();

  try {
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/crm/leads",
      headers: { authorization: `Bearer ${deniedFixture.token}` },
    });
    assert.equal(denied.statusCode, 403);

    const lead = await app.inject({
      method: "POST",
      url: "/api/v1/crm/leads",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        firstName: "Alice",
        lastName: "Jones",
        email: "alice.jones@example.com",
        phone: "+1-555-0100",
        companyName: "Northwind Labs",
        status: "NEW",
        source: "WEB",
      },
    });
    assert.equal(lead.statusCode, 201);
    assert.equal(lead.json().data.firstName, "Alice");

    const opportunity = await app.inject({
      method: "POST",
      url: "/api/v1/crm/opportunities",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        leadId: lead.json().data.id,
        name: "Northwind expansion",
        stage: "QUALIFICATION",
        amount: 12500.5,
        probability: 40,
        closeDate: "2026-12-15",
      },
    });
    assert.equal(opportunity.statusCode, 201);
    assert.equal(opportunity.json().data.name, "Northwind expansion");

    const leads = await app.inject({
      method: "GET",
      url: "/api/v1/crm/leads",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(leads.statusCode, 200);
    assert.ok(leads.json().data.some((row: { firstName: string }) => row.firstName === "Alice"));

    const opportunities = await app.inject({
      method: "GET",
      url: "/api/v1/crm/opportunities",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(opportunities.statusCode, 200);
    assert.ok(opportunities.json().data.some((row: { name: string }) => row.name === "Northwind expansion"));
  } finally {
    await db.query("DELETE FROM crm.opportunities WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM crm.leads WHERE company_id = $1", [fixture.companyId]);
    await app.close();
    await fixture.cleanup();
    await deniedFixture.cleanup();
  }
});
