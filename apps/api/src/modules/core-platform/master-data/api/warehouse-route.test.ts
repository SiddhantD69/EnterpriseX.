import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../../app.js";
import { db } from "../../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "./master-data-test-fixtures.js";

const createPlant = async (
  app: ReturnType<typeof buildApp>,
  fixture: Awaited<ReturnType<typeof createMasterDataTestSession>>,
) => {
  const code = `PLANT-${randomUUID()}`;
  fixture.trackPlantCode(code);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/core/plants",
    headers: {
      authorization: `Bearer ${fixture.token}`,
    },
    payload: { code, name: "Warehouse Test Plant" },
  });

  assert.equal(response.statusCode, 201);
  return response.json().data as { id: string };
};

const createWarehouse = async (
  app: ReturnType<typeof buildApp>,
  fixture: Awaited<ReturnType<typeof createMasterDataTestSession>>,
  plantId: string,
  code: string,
) => {
  fixture.trackWarehouseCode(code);
  return app.inject({
    method: "POST",
    url: "/api/v1/core/warehouses",
    headers: {
      authorization: `Bearer ${fixture.token}`,
    },
    payload: {
      plantId,
      code,
      name: "Warehouse Test Warehouse",
    },
  });
};

test("Warehouse API enforces authentication and endpoint permissions", async () => {
  const fixture = await createMasterDataTestSession([]);
  const app = buildApp();

  try {
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/core/warehouses",
    });
    assert.equal(unauthenticated.statusCode, 401);

    const requests = [
      {
        method: "GET",
        url: "/api/v1/core/warehouses",
      },
      {
        method: "POST",
        url: "/api/v1/core/warehouses",
        payload: {
          plantId: randomUUID(),
          code: `WH-${randomUUID()}`,
          name: "Forbidden Warehouse",
        },
      },
      {
        method: "PUT",
        url: `/api/v1/core/warehouses/${randomUUID()}`,
        payload: {
          plantId: randomUUID(),
          code: `WH-${randomUUID()}`,
          name: "Forbidden Warehouse",
          status: "ACTIVE",
        },
      },
    ] as const;

    for (const request of requests) {
      const response = await app.inject({
        ...request,
        headers: {
          authorization: `Bearer ${fixture.token}`,
        },
      });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error.code, "FORBIDDEN");
    }
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Warehouse API supports authorized list, get, create, update, and audit", async () => {
  const fixture = await createMasterDataTestSession([
    "core.plants.create",
    "core.warehouses.read",
    "core.warehouses.create",
    "core.warehouses.update",
  ]);
  const app = buildApp();

  try {
    const plant = await createPlant(app, fixture);
    const originalCode = `WH-${randomUUID()}`;
    const created = await createWarehouse(
      app,
      fixture,
      plant.id,
      originalCode,
    );
    assert.equal(created.statusCode, 201);
    const warehouse = created.json().data as {
      id: string;
      companyId: string;
      plantId: string;
      code: string;
    };
    assert.equal(warehouse.companyId, fixture.companyId);
    assert.equal(warehouse.plantId, plant.id);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/core/warehouses",
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().data.length, 1);
    assert.equal(listed.json().data[0].warehouseType, "STANDARD");

    const fetched = await app.inject({
      method: "GET",
      url: `/api/v1/core/warehouses/${warehouse.id}`,
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
    });
    assert.equal(fetched.statusCode, 200);
    assert.equal(fetched.json().data.id, warehouse.id);

    const updatedCode = `WH-${randomUUID()}`;
    fixture.trackWarehouseCode(updatedCode);
    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/core/warehouses/${warehouse.id}`,
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
      payload: {
        plantId: plant.id,
        code: updatedCode,
        name: "Updated Test Warehouse",
        warehouseType: "FINISHED_GOODS",
        status: "ACTIVE",
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().data.code, updatedCode);
    assert.equal(updated.json().data.warehouseType, "FINISHED_GOODS");

    const audit = await db.query<{ action: string }>(
      `
        SELECT action
        FROM core.audit_events
        WHERE company_id = $1
          AND entity_type = 'WAREHOUSE'
          AND entity_id = $2
          AND action IN ('WAREHOUSE_CREATED', 'WAREHOUSE_UPDATED')
        ORDER BY action
      `,
      [fixture.companyId, warehouse.id],
    );
    assert.deepEqual(
      audit.rows.map((row) => row.action),
      ["WAREHOUSE_CREATED", "WAREHOUSE_UPDATED"],
    );
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Warehouse API isolates companies and validates plant ownership and duplicate codes", async () => {
  const firstCompany = await createMasterDataTestSession([
    "core.plants.create",
    "core.warehouses.read",
    "core.warehouses.create",
  ]);
  const secondCompany = await createMasterDataTestSession([
    "core.plants.create",
    "core.warehouses.read",
    "core.warehouses.create",
  ]);
  const app = buildApp();

  try {
    const firstPlant = await createPlant(app, firstCompany);
    const foreignPlant = await createPlant(app, secondCompany);
    const sharedCode = `WH-${randomUUID()}`;

    const clientCompanyCode = `WH-${randomUUID()}`;
    firstCompany.trackWarehouseCode(clientCompanyCode);
    const clientCompany = await app.inject({
      method: "POST",
      url: "/api/v1/core/warehouses",
      headers: {
        authorization: `Bearer ${firstCompany.token}`,
      },
      payload: {
        plantId: firstPlant.id,
        code: clientCompanyCode,
        name: "Client Company Attempt",
        companyId: secondCompany.companyId,
      },
    });
    assert.equal(clientCompany.statusCode, 400);

    const firstWarehouse = await createWarehouse(
      app,
      firstCompany,
      firstPlant.id,
      sharedCode,
    );
    assert.equal(firstWarehouse.statusCode, 201);

    const duplicate = await createWarehouse(
      app,
      firstCompany,
      firstPlant.id,
      sharedCode,
    );
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().error, "WAREHOUSE_CODE_CONFLICT");

    const sameCodeOtherCompany = await createWarehouse(
      app,
      secondCompany,
      foreignPlant.id,
      sharedCode,
    );
    assert.equal(sameCodeOtherCompany.statusCode, 201);

    const crossCompanyPlant = await createWarehouse(
      app,
      firstCompany,
      foreignPlant.id,
      `WH-${randomUUID()}`,
    );
    assert.equal(crossCompanyPlant.statusCode, 404);
    assert.equal(crossCompanyPlant.json().error, "PLANT_NOT_FOUND");

    const firstList = await app.inject({
      method: "GET",
      url: "/api/v1/core/warehouses",
      headers: {
        authorization: `Bearer ${firstCompany.token}`,
      },
    });
    assert.equal(firstList.statusCode, 200);
    assert.equal(firstList.json().data.length, 1);

    const foreignWarehouseId = sameCodeOtherCompany.json().data.id;
    const foreignLookup = await app.inject({
      method: "GET",
      url: `/api/v1/core/warehouses/${foreignWarehouseId}`,
      headers: {
        authorization: `Bearer ${firstCompany.token}`,
      },
    });
    assert.equal(foreignLookup.statusCode, 404);
  } finally {
    try {
      await app.close();
    } finally {
      try {
        await firstCompany.cleanup();
      } finally {
        await secondCompany.cleanup();
      }
    }
  }
});