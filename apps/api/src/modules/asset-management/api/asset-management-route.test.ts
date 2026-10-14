import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";

test("Asset, project, and service workflow validates permissions and company-scoped isolation", async () => {
  const fixture = await createMasterDataTestSession([
    "assets.read",
    "assets.create",
    "projects.read",
    "projects.create",
    "services.read",
    "services.create",
  ]);
  const deniedFixture = await createMasterDataTestSession([]);
  const app = buildApp();

  try {
    const deniedAssets = await app.inject({
      method: "GET",
      url: "/api/v1/assets",
      headers: { authorization: `Bearer ${deniedFixture.token}` },
    });
    assert.equal(deniedAssets.statusCode, 403);

    const asset = await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: "ASSET-1001",
        name: "Machining Center",
        category: "MACHINE",
        status: "ACTIVE",
        cost: 50000,
        location: "Plant-1",
      },
    });
    assert.equal(asset.statusCode, 201);
    assert.equal(asset.json().data.code, "ASSET-1001");

    const project = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: "PROJ-1001",
        name: "Facility Upgrade",
        status: "PLANNED",
        managerUserId: fixture.userId,
        budget: 250000,
        description: "Site upgrade project",
      },
    });
    assert.equal(project.statusCode, 201);
    assert.equal(project.json().data.code, "PROJ-1001");

    const serviceCall = await app.inject({
      method: "POST",
      url: "/api/v1/services",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        projectId: project.json().data.id,
        assetId: asset.json().data.id,
        code: "SRV-1001",
        name: "Preventive Maintenance",
        status: "OPEN",
        priority: "HIGH",
        description: "Routine maintenance work order",
      },
    });
    assert.equal(serviceCall.statusCode, 201);
    assert.equal(serviceCall.json().data.name, "Preventive Maintenance");

    const assets = await app.inject({
      method: "GET",
      url: "/api/v1/assets",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(assets.statusCode, 200);
    assert.ok(assets.json().data.some((row: { code: string }) => row.code === "ASSET-1001"));

    const projects = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(projects.statusCode, 200);
    assert.ok(projects.json().data.some((row: { code: string }) => row.code === "PROJ-1001"));

    const services = await app.inject({
      method: "GET",
      url: "/api/v1/services",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(services.statusCode, 200);
    assert.ok(services.json().data.some((row: { name: string }) => row.name === "Preventive Maintenance"));
  } finally {
    await db.query("DELETE FROM asset_management.services WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM asset_management.projects WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM asset_management.assets WHERE company_id = $1", [fixture.companyId]);
    await app.close();
    await fixture.cleanup();
    await deniedFixture.cleanup();
  }
});
