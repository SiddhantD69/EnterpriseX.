import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";

test("Manufacturing BOMs, production orders, material issue, and completion workflow", async () => {
  const fixture = await createMasterDataTestSession([
    "manufacturing.read",
    "manufacturing.boms.read",
    "manufacturing.boms.create",
    "manufacturing.orders.read",
    "manufacturing.orders.create",
    "manufacturing.orders.issue",
    "manufacturing.orders.confirm",
  ]);
  const deniedFixture = await createMasterDataTestSession([]);
  const app = buildApp();

  await db.query(
    `
      INSERT INTO core.units_of_measure (code, name, decimal_places, status)
      VALUES ('EA', 'Each', 0, 'ACTIVE')
      ON CONFLICT (code) DO NOTHING
    `,
  );

  const plant = await db.query<{ id: string }>(
    `
      INSERT INTO core.plants (company_id, code, name, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      RETURNING id
    `,
    [fixture.companyId, `PL-${Date.now()}`, "Main Plant"],
  );
  const warehouse = await db.query<{ id: string }>(
    `
      INSERT INTO core.warehouses (company_id, plant_id, code, name, warehouse_type, status)
      VALUES ($1, $2, $3, $4, 'RAW_MATERIAL', 'ACTIVE')
      RETURNING id
    `,
    [fixture.companyId, plant.rows[0].id, `WH-${Date.now()}`, "Raw Store"],
  );
  const storageLocation = await db.query<{ id: string }>(
    `
      INSERT INTO core.storage_locations (company_id, warehouse_id, code, name, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING id
    `,
    [fixture.companyId, warehouse.rows[0].id, `SL-${Date.now()}`, "Main Storage"],
  );
  const rawMaterial = await db.query<{ id: string }>(
    `
      INSERT INTO core.materials (company_id, code, name, base_unit_code, status)
      VALUES ($1, $2, $3, 'EA', 'ACTIVE')
      RETURNING id
    `,
    [fixture.companyId, `MAT-${Date.now()}`, "Steel Rod"],
  );
  const finishedMaterial = await db.query<{ id: string }>(
    `
      INSERT INTO core.materials (company_id, code, name, base_unit_code, status)
      VALUES ($1, $2, $3, 'EA', 'ACTIVE')
      RETURNING id
    `,
    [fixture.companyId, `FG-${Date.now()}`, "Gearbox Assembly"],
  );
  await db.query(
    `
      INSERT INTO inventory.stock_balances (company_id, storage_location_id, material_id, quantity)
      VALUES ($1, $2, $3, 50)
      ON CONFLICT (company_id, storage_location_id, material_id)
      DO UPDATE SET quantity = inventory.stock_balances.quantity + EXCLUDED.quantity
    `,
    [fixture.companyId, storageLocation.rows[0].id, rawMaterial.rows[0].id],
  );

  try {
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/manufacturing/boms",
      headers: { authorization: `Bearer ${deniedFixture.token}` },
    });
    assert.equal(denied.statusCode, 403);

    const bom = await app.inject({
      method: "POST",
      url: "/api/v1/manufacturing/boms",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        productMaterialId: finishedMaterial.rows[0].id,
        quantityPerBatch: 5,
        description: "Gearbox assembly line",
        lines: [{ materialId: rawMaterial.rows[0].id, quantity: 2 }],
      },
    });
    assert.equal(bom.statusCode, 201);
    const bomId = bom.json().data.id;

    const productionOrder = await app.inject({
      method: "POST",
      url: "/api/v1/manufacturing/production-orders",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        bomId,
        plantId: plant.rows[0].id,
        plannedQuantity: 3,
        description: "Build gearbox batch",
      },
    });
    assert.equal(productionOrder.statusCode, 201);
    const orderId = productionOrder.json().data.id;

    const issue = await app.inject({
      method: "POST",
      url: `/api/v1/manufacturing/production-orders/${orderId}/issue`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        storageLocationId: storageLocation.rows[0].id,
        lines: [{ materialId: rawMaterial.rows[0].id, quantity: 6 }],
      },
    });
    assert.equal(issue.statusCode, 200);
    assert.equal(issue.json().data.status, "IN_PROGRESS");

    const confirm = await app.inject({
      method: "POST",
      url: `/api/v1/manufacturing/production-orders/${orderId}/confirm`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        storageLocationId: storageLocation.rows[0].id,
        producedQuantity: 3,
      },
    });
    assert.equal(confirm.statusCode, 200);
    assert.equal(confirm.json().data.status, "COMPLETED");
    assert.equal(confirm.json().data.producedQuantity, 3);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/manufacturing/production-orders",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(list.statusCode, 200);
    assert.ok(list.json().data.some((row: { id: string }) => row.id === orderId));
  } finally {
    await db.query("DELETE FROM inventory.stock_movements WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM inventory.stock_balances WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM manufacturing.production_order_issues WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM manufacturing.production_order_confirmations WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM manufacturing.production_orders WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM manufacturing.bom_lines WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM manufacturing.boms WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM core.materials WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM core.storage_locations WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM core.warehouses WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM core.plants WHERE company_id = $1", [fixture.companyId]);
    await fixture.cleanup();
    await deniedFixture.cleanup();
  }
});
