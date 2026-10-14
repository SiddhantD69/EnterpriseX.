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
    payload: { code, name: "Storage Location Test Plant" },
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
      name: "Storage Location Test Warehouse",
    },
  });
};

const createStorageLocation = async (
  app: ReturnType<typeof buildApp>,
  fixture: Awaited<ReturnType<typeof createMasterDataTestSession>>,
  warehouseId: string,
  code: string,
) => {
  fixture.trackStorageLocationCode(code);
  return app.inject({
    method: "POST",
    url: "/api/v1/core/storage-locations",
    headers: {
      authorization: `Bearer ${fixture.token}`,
    },
    payload: {
      warehouseId,
      code,
      name: "Storage Location Test Location",
    },
  });
};

test("Storage Location API enforces authentication and endpoint permissions", async () => {
  const fixture = await createMasterDataTestSession([]);
  const app = buildApp();

  try {
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/core/storage-locations",
    });
    assert.equal(unauthenticated.statusCode, 401);

    const requests = [
      {
        method: "GET",
        url: "/api/v1/core/storage-locations",
      },
      {
        method: "POST",
        url: "/api/v1/core/storage-locations",
        payload: {
          warehouseId: randomUUID(),
          code: `SL-${randomUUID()}`,
          name: "Forbidden Location",
        },
      },
      {
        method: "PUT",
        url: `/api/v1/core/storage-locations/${randomUUID()}`,
        payload: {
          warehouseId: randomUUID(),
          code: `SL-${randomUUID()}`,
          name: "Forbidden Location",
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

test("Storage Location API supports authorized list, get, create, update, and audit", async () => {
  const fixture = await createMasterDataTestSession([
    "core.plants.create",
    "core.warehouses.create",
    "core.storage_locations.read",
    "core.storage_locations.create",
    "core.storage_locations.update",
  ]);
  const app = buildApp();

  try {
    const plant = await createPlant(app, fixture);
    const warehouseCode = `WH-${randomUUID()}`;
    const warehouseResponse = await createWarehouse(
      app,
      fixture,
      plant.id,
      warehouseCode,
    );
    assert.equal(warehouseResponse.statusCode, 201);
    const warehouseId = warehouseResponse.json().data.id as string;

    const originalCode = `SL-${randomUUID()}`;
    const created = await createStorageLocation(
      app,
      fixture,
      warehouseId,
      originalCode,
    );
    assert.equal(created.statusCode, 201);
    const location = created.json().data as {
      id: string;
      companyId: string;
      warehouseId: string;
    };
    assert.equal(location.companyId, fixture.companyId);
    assert.equal(location.warehouseId, warehouseId);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/core/storage-locations",
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().data.length, 1);

    const fetched = await app.inject({
      method: "GET",
      url: `/api/v1/core/storage-locations/${location.id}`,
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
    });
    assert.equal(fetched.statusCode, 200);
    assert.equal(fetched.json().data.id, location.id);

    const updatedCode = `SL-${randomUUID()}`;
    fixture.trackStorageLocationCode(updatedCode);
    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/core/storage-locations/${location.id}`,
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
      payload: {
        warehouseId,
        code: updatedCode,
        name: "Updated Test Location",
        status: "INACTIVE",
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().data.code, updatedCode);
    assert.equal(updated.json().data.status, "INACTIVE");

    const audit = await db.query<{ action: string }>(
      `
        SELECT action
        FROM core.audit_events
        WHERE company_id = $1
          AND entity_type = 'STORAGE_LOCATION'
          AND entity_id = $2
          AND action IN ('STORAGE_LOCATION_CREATED', 'STORAGE_LOCATION_UPDATED')
        ORDER BY action
      `,
      [fixture.companyId, location.id],
    );
    assert.deepEqual(
      audit.rows.map((row) => row.action),
      ["STORAGE_LOCATION_CREATED", "STORAGE_LOCATION_UPDATED"],
    );
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Storage Location API isolates companies and validates warehouse ownership and duplicate scope", async () => {
  const firstCompany = await createMasterDataTestSession([
    "core.plants.create",
    "core.warehouses.create",
    "core.storage_locations.read",
    "core.storage_locations.create",
  ]);
  const secondCompany = await createMasterDataTestSession([
    "core.plants.create",
    "core.warehouses.create",
    "core.storage_locations.create",
  ]);
  const app = buildApp();

  try {
    const firstPlant = await createPlant(app, firstCompany);
    const secondPlant = await createPlant(app, secondCompany);
    const firstWarehouseResponse = await createWarehouse(
      app,
      firstCompany,
      firstPlant.id,
      `WH-${randomUUID()}`,
    );
    const secondWarehouseResponse = await createWarehouse(
      app,
      firstCompany,
      firstPlant.id,
      `WH-${randomUUID()}`,
    );
    const foreignWarehouseResponse = await createWarehouse(
      app,
      secondCompany,
      secondPlant.id,
      `WH-${randomUUID()}`,
    );
    assert.equal(firstWarehouseResponse.statusCode, 201);
    assert.equal(secondWarehouseResponse.statusCode, 201);
    assert.equal(foreignWarehouseResponse.statusCode, 201);

    const firstWarehouseId = firstWarehouseResponse.json().data.id as string;
    const secondWarehouseId = secondWarehouseResponse.json().data.id as string;
    const foreignWarehouseId = foreignWarehouseResponse.json().data.id as string;
    const sharedCode = `SL-${randomUUID()}`;

    const clientCompanyCode = `SL-${randomUUID()}`;
    firstCompany.trackStorageLocationCode(clientCompanyCode);
    const clientCompany = await app.inject({
      method: "POST",
      url: "/api/v1/core/storage-locations",
      headers: {
        authorization: `Bearer ${firstCompany.token}`,
      },
      payload: {
        warehouseId: firstWarehouseId,
        code: clientCompanyCode,
        name: "Client Company Attempt",
        companyId: secondCompany.companyId,
      },
    });
    assert.equal(clientCompany.statusCode, 400);

    const firstLocation = await createStorageLocation(
      app,
      firstCompany,
      firstWarehouseId,
      sharedCode,
    );
    assert.equal(firstLocation.statusCode, 201);

    const duplicate = await createStorageLocation(
      app,
      firstCompany,
      firstWarehouseId,
      sharedCode,
    );
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().error, "STORAGE_LOCATION_CODE_CONFLICT");

    const sameCodeOtherWarehouse = await createStorageLocation(
      app,
      firstCompany,
      secondWarehouseId,
      sharedCode,
    );
    assert.equal(sameCodeOtherWarehouse.statusCode, 201);

    const crossCompanyWarehouse = await createStorageLocation(
      app,
      firstCompany,
      foreignWarehouseId,
      `SL-${randomUUID()}`,
    );
    assert.equal(crossCompanyWarehouse.statusCode, 404);
    assert.equal(crossCompanyWarehouse.json().error, "WAREHOUSE_NOT_FOUND");

    const firstList = await app.inject({
      method: "GET",
      url: "/api/v1/core/storage-locations",
      headers: {
        authorization: `Bearer ${firstCompany.token}`,
      },
    });
    assert.equal(firstList.statusCode, 200);
    assert.equal(firstList.json().data.length, 2);

    const foreignLocation = await createStorageLocation(
      app,
      secondCompany,
      foreignWarehouseId,
      `SL-${randomUUID()}`,
    );
    assert.equal(foreignLocation.statusCode, 201);

    const foreignLookup = await app.inject({
      method: "GET",
      url: `/api/v1/core/storage-locations/${foreignLocation.json().data.id}`,
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