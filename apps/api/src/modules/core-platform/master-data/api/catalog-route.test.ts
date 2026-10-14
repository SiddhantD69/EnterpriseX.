import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../../app.js";
import { db } from "../../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "./master-data-test-fixtures.js";

const createCurrencyCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const hex = randomUUID().replace(/-/g, "").slice(0, 3);
    const code = [...hex]
      .map((character) =>
        String.fromCharCode(65 + (Number.parseInt(character, 16) % 26)),
      )
      .join("");
    const result = await db.query(
      "SELECT code FROM core.currencies WHERE code = $1",
      [code],
    );
    if (result.rowCount === 0) return code;
  }
  throw new Error("Could not allocate a unique test currency code.");
};

test("Core catalog supports company-scoped suppliers/materials and shared unit/currency setup", async () => {
  const fixture = await createMasterDataTestSession([
    "core.suppliers.read",
    "core.suppliers.create",
    "core.suppliers.update",
    "core.materials.read",
    "core.materials.create",
    "core.materials.update",
    "core.currencies.read",
    "core.currencies.create",
    "core.units_of_measure.read",
    "core.units_of_measure.create",
  ]);
  const app = buildApp();
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const unitCode = `EA_${suffix}`;
  const currencyCode = await createCurrencyCode();
  fixture.trackUnitCode(unitCode);
  fixture.trackCurrencyCode(currencyCode);
  const supplierCode = `SUP-${suffix}`;
  const materialCode = `MAT-${suffix}`;

  try {
    const unit = await app.inject({
      method: "POST",
      url: "/api/v1/core/units-of-measure",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: unitCode, name: "Test Each", decimalPlaces: 0 },
    });
    assert.equal(unit.statusCode, 201);
    assert.equal(unit.json().data.code, unitCode);

    const currency = await app.inject({
      method: "POST",
      url: "/api/v1/core/currencies",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: currencyCode, name: "Test Currency", decimalPlaces: 2 },
    });
    assert.equal(currency.statusCode, 201);

    const supplier = await app.inject({
      method: "POST",
      url: "/api/v1/core/suppliers",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: supplierCode,
        name: "Test Supplier",
        email: "purchasing@example.invalid",
      },
    });
    assert.equal(supplier.statusCode, 201);
    assert.equal(supplier.json().data.companyId, fixture.companyId);

    const material = await app.inject({
      method: "POST",
      url: "/api/v1/core/materials",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: materialCode, name: "Test Material", baseUnitCode: unitCode.toLowerCase() },
    });
    assert.equal(material.statusCode, 201);
    assert.equal(material.json().data.baseUnitCode, unitCode);

    const supplierList = await app.inject({
      method: "GET",
      url: "/api/v1/core/suppliers",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(supplierList.statusCode, 200);
    assert.ok(supplierList.json().data.some((item: { code: string }) => item.code === supplierCode));

    const materialStatus = await app.inject({
      method: "PUT",
      url: `/api/v1/core/materials/${material.json().data.id}/status`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { status: "INACTIVE" },
    });
    assert.equal(materialStatus.statusCode, 200);
    assert.equal(materialStatus.json().data.status, "INACTIVE");

    const invalidMaterial = await app.inject({
      method: "POST",
      url: "/api/v1/core/materials",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: `BAD-${suffix}`, name: "Bad Material", baseUnitCode: "MISSING" },
    });
    assert.equal(invalidMaterial.statusCode, 404);
    assert.equal(invalidMaterial.json().error, "UNIT_NOT_FOUND");

    const audit = await db.query<{ action: string }>(
      `
        SELECT action
        FROM core.audit_events
        WHERE company_id = $1
          AND action IN ('SUPPLIER_CREATED', 'MATERIAL_CREATED', 'MATERIAL_STATUS_UPDATED')
        ORDER BY action
      `,
      [fixture.companyId],
    );
    assert.deepEqual(audit.rows.map((row) => row.action), [
      "MATERIAL_CREATED",
      "MATERIAL_STATUS_UPDATED",
      "SUPPLIER_CREATED",
    ]);
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});