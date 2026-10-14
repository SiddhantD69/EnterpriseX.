import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";
import { createGoodsReceipt } from "../../inventory/application/goods-receipt-service.js";

const createReferenceCode = async (
  table: "core.currencies" | "core.units_of_measure",
  length: number,
): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const hex = randomUUID().replace(/-/g, "").slice(0, length);
    const code = table === "core.currencies"
      ? [...hex]
        .map((character) =>
          String.fromCharCode(65 + (Number.parseInt(character, 16) % 26)),
        )
        .join("")
      : hex.toUpperCase();
    const result = await db.query(`SELECT code FROM ${table} WHERE code = $1`, [code]);
    if (result.rowCount === 0) return code;
  }
  throw new Error(`Could not allocate a unique test ${table} code.`);
};

const workflowPermissions = [
  "core.plants.create",
  "core.warehouses.create",
  "core.storage_locations.create",
  "core.suppliers.read",
  "core.suppliers.create",
  "core.materials.read",
  "core.materials.create",
  "core.currencies.read",
  "core.currencies.create",
  "core.units_of_measure.read",
  "core.units_of_measure.create",
  "procurement.requisitions.read",
  "procurement.requisitions.create",
  "procurement.requisitions.update",
  "procurement.requisitions.submit",
  "procurement.purchase_orders.read",
  "procurement.purchase_orders.create",
  "inventory.goods_receipts.create",
  "inventory.stock.read",
  "procurement.supplier_invoices.read",
  "procurement.supplier_invoices.create",
];

test("Procurement and Inventory endpoints reject unauthenticated and unauthorized access", async () => {
  const fixture = await createMasterDataTestSession([]);
  const app = buildApp();

  try {
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/procurement/requisitions",
    });
    assert.equal(unauthenticated.statusCode, 401);

    const requests = [
      { method: "GET", url: "/api/v1/procurement/requisitions" },
      { method: "POST", url: "/api/v1/procurement/requisitions", payload: {} },
      { method: "GET", url: "/api/v1/procurement/purchase-orders" },
      { method: "GET", url: "/api/v1/procurement/supplier-invoices" },
      { method: "GET", url: "/api/v1/inventory/stock-balances" },
      { method: "GET", url: "/api/v1/inventory/stock-movements" },
      { method: "POST", url: `/api/v1/inventory/purchase-orders/${randomUUID()}/receipts`, payload: {} },
    ] as const;

    for (const request of requests) {
      const response = await app.inject({
        ...request,
        headers: { authorization: `Bearer ${fixture.token}` },
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

test("Procurement to inventory workflow persists, matches, audits, and isolates company data", async () => {
  const fixture = await createMasterDataTestSession(workflowPermissions);
  const otherCompany = await createMasterDataTestSession([
    "procurement.requisitions.create",
  ]);
  const app = buildApp();
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const unitCode = `EA_${suffix}`;
  const currencyCode = await createReferenceCode("core.currencies", 3);
  fixture.trackUnitCode(unitCode);
  fixture.trackCurrencyCode(currencyCode);
  let plantId = "";
  let warehouseId = "";
  let storageLocationId = "";
  let supplierId = "";
  let materialId = "";

  try {
    const currency = await app.inject({
      method: "POST",
      url: "/api/v1/core/currencies",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: currencyCode, name: "Workflow Currency", decimalPlaces: 2 },
    });
    assert.equal(currency.statusCode, 201);

    const unit = await app.inject({
      method: "POST",
      url: "/api/v1/core/units-of-measure",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: unitCode, name: "Workflow Each", decimalPlaces: 0 },
    });
    assert.equal(unit.statusCode, 201);

    const plantCode = `PL-${suffix}`;
    fixture.trackPlantCode(plantCode);
    const plant = await app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: plantCode, name: "Workflow Plant" },
    });
    assert.equal(plant.statusCode, 201);
    plantId = plant.json().data.id;

    const warehouseCode = `WH-${suffix}`;
    fixture.trackWarehouseCode(warehouseCode);
    const warehouse = await app.inject({
      method: "POST",
      url: "/api/v1/core/warehouses",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { plantId, code: warehouseCode, name: "Workflow Warehouse" },
    });
    assert.equal(warehouse.statusCode, 201);
    warehouseId = warehouse.json().data.id;

    const locationCode = `SL-${suffix}`;
    fixture.trackStorageLocationCode(locationCode);
    const location = await app.inject({
      method: "POST",
      url: "/api/v1/core/storage-locations",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { warehouseId, code: locationCode, name: "Workflow Location" },
    });
    assert.equal(location.statusCode, 201);
    storageLocationId = location.json().data.id;

    const supplierCode = `SUP-${suffix}`;
    const supplier = await app.inject({
      method: "POST",
      url: "/api/v1/core/suppliers",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: supplierCode, name: "Workflow Supplier" },
    });
    assert.equal(supplier.statusCode, 201);
    supplierId = supplier.json().data.id;

    const materialCode = `MAT-${suffix}`;
    const material = await app.inject({
      method: "POST",
      url: "/api/v1/core/materials",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: materialCode, name: "Workflow Material", baseUnitCode: unitCode },
    });
    assert.equal(material.statusCode, 201);
    materialId = material.json().data.id;

    const otherCompanyPlant = await app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: { code: `PL-OTHER-${suffix}`, name: "Other Company Plant" },
    });
    assert.equal(otherCompanyPlant.statusCode, 201);
    fixture.trackPlantCode(`PL-OTHER-${suffix}`);
    const crossCompanyRequisition = await app.inject({
      method: "POST",
      url: "/api/v1/procurement/requisitions",
      headers: { authorization: `Bearer ${otherCompany.token}` },
      payload: {
        plantId,
        lines: [{ materialId, unitCode, quantity: 1 }],
      },
    });
    assert.equal(crossCompanyRequisition.statusCode, 404);
    assert.equal(crossCompanyRequisition.json().error, "PLANT_NOT_FOUND");

    const requisitionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/procurement/requisitions",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        plantId,
        description: "Initial purchasing test",
        lines: [{ materialId, unitCode, quantity: 5 }],
      },
    });
    assert.equal(requisitionResponse.statusCode, 201);
    const requisition = requisitionResponse.json().data;
    assert.equal(requisition.status, "DRAFT");

    const updatedRequisition = await app.inject({
      method: "PUT",
      url: `/api/v1/procurement/requisitions/${requisition.id}`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        plantId,
        description: "Updated purchasing test",
        lines: [{ materialId, unitCode, quantity: 10 }],
      },
    });
    assert.equal(updatedRequisition.statusCode, 200);
    const requisitionLineId = updatedRequisition.json().data.lines[0].id;
    assert.equal(updatedRequisition.json().data.lines[0].quantity, 10);

    const submitted = await app.inject({
      method: "POST",
      url: `/api/v1/procurement/requisitions/${requisition.id}/submit`,
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(submitted.statusCode, 200);
    assert.equal(submitted.json().data.status, "SUBMITTED");

    const purchaseOrderResponse = await app.inject({
      method: "POST",
      url: `/api/v1/procurement/requisitions/${requisition.id}/purchase-order`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        supplierId,
        currencyCode,
        unitPrices: [{ requisitionLineId, unitPrice: 12.5 }],
      },
    });
    assert.equal(purchaseOrderResponse.statusCode, 201);
    const purchaseOrder = purchaseOrderResponse.json().data;

    const orders = await app.inject({
      method: "GET",
      url: "/api/v1/procurement/purchase-orders",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(orders.statusCode, 200);
    const order = orders.json().data.find((row: { id: string }) => row.id === purchaseOrder.id);
    assert.ok(order);
    assert.equal(order.lines[0].quantity, 10);
    const purchaseOrderLineId = order.lines[0].id;

    await assert.rejects(
      createGoodsReceipt(
        fixture.companyId,
        purchaseOrder.id,
        fixture.userId,
        {
          lines: [{ purchaseOrderLineId, storageLocationId, quantity: 2 }],
        },
        {
          actorUserId: randomUUID(),
          organizationId: fixture.organizationId,
        },
      ),
    );
    const rollbackCheck = await db.query<{ received_quantity: string }>(
      `
        SELECT received_quantity
        FROM procurement.purchase_order_lines
        WHERE company_id = $1 AND id = $2
      `,
      [fixture.companyId, purchaseOrderLineId],
    );
    assert.equal(Number(rollbackCheck.rows[0].received_quantity), 0);
    const noRolledBackStock = await db.query(
      `
        SELECT id
        FROM inventory.stock_balances
        WHERE company_id = $1
          AND storage_location_id = $2
          AND material_id = $3
      `,
      [fixture.companyId, storageLocationId, materialId],
    );
    assert.equal(noRolledBackStock.rowCount, 0);

    const firstReceipt = await app.inject({
      method: "POST",
      url: `/api/v1/inventory/purchase-orders/${purchaseOrder.id}/receipts`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        lines: [{ purchaseOrderLineId, storageLocationId, quantity: 4 }],
      },
    });
    assert.equal(firstReceipt.statusCode, 201);

    const overReceipt = await app.inject({
      method: "POST",
      url: `/api/v1/inventory/purchase-orders/${purchaseOrder.id}/receipts`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        lines: [{ purchaseOrderLineId, storageLocationId, quantity: 7 }],
      },
    });
    assert.equal(overReceipt.statusCode, 409);
    assert.equal(overReceipt.json().error, "RECEIPT_EXCEEDS_ORDER");

    const secondReceipt = await app.inject({
      method: "POST",
      url: `/api/v1/inventory/purchase-orders/${purchaseOrder.id}/receipts`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        lines: [{ purchaseOrderLineId, storageLocationId, quantity: 6 }],
      },
    });
    assert.equal(secondReceipt.statusCode, 201);
    assert.equal(secondReceipt.json().data.lines[0].quantity, 6);

    const stockResponse = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/stock-balances",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(stockResponse.statusCode, 200);
    const stock = stockResponse.json().data.find(
      (row: { materialId: string; storageLocationId: string }) =>
        row.materialId === materialId && row.storageLocationId === storageLocationId,
    );
    assert.equal(stock.quantity, 10);

    const movementsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/stock-movements",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    const movements = movementsResponse.json().data.filter(
      (row: { materialId: string; storageLocationId: string }) =>
        row.materialId === materialId && row.storageLocationId === storageLocationId,
    );
    assert.equal(movements.length, 2);
    assert.equal(movements.reduce((sum: number, row: { quantityDelta: number }) => sum + row.quantityDelta, 0), 10);

    const invoiceBody = {
      supplierInvoiceNumber: `INV-${suffix}`,
      lines: [{ purchaseOrderLineId, quantity: 4, unitPrice: 12.5 }],
    };
    const invoiceQuantityOver = await app.inject({
      method: "POST",
      url: `/api/v1/procurement/purchase-orders/${purchaseOrder.id}/supplier-invoices`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        supplierInvoiceNumber: `INV-OVER-${suffix}`,
        lines: [{ purchaseOrderLineId, quantity: 11, unitPrice: 12.5 }],
      },
    });
    assert.equal(invoiceQuantityOver.statusCode, 409);
    assert.equal(invoiceQuantityOver.json().error, "INVOICE_EXCEEDS_RECEIPTS");

    const invoicePriceMismatch = await app.inject({
      method: "POST",
      url: `/api/v1/procurement/purchase-orders/${purchaseOrder.id}/supplier-invoices`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        supplierInvoiceNumber: `INV-PRICE-${suffix}`,
        lines: [{ purchaseOrderLineId, quantity: 1, unitPrice: 12.51 }],
      },
    });
    assert.equal(invoicePriceMismatch.statusCode, 409);
    assert.equal(invoicePriceMismatch.json().error, "INVOICE_PRICE_MISMATCH");

    const invoice = await app.inject({
      method: "POST",
      url: `/api/v1/procurement/purchase-orders/${purchaseOrder.id}/supplier-invoices`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: invoiceBody,
    });
    assert.equal(invoice.statusCode, 201);
    assert.equal(invoice.json().data.status, "MATCHED");

    const invoiceList = await app.inject({
      method: "GET",
      url: "/api/v1/procurement/supplier-invoices",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(invoiceList.statusCode, 200);
    assert.ok(invoiceList.json().data.some((row: { id: string }) => row.id === invoice.json().data.id));

    const duplicateInvoice = await app.inject({
      method: "POST",
      url: `/api/v1/procurement/purchase-orders/${purchaseOrder.id}/supplier-invoices`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: invoiceBody,
    });
    assert.equal(duplicateInvoice.statusCode, 409);
    assert.equal(duplicateInvoice.json().error, "DUPLICATE_SUPPLIER_INVOICE");

    const secondInvoice = await app.inject({
      method: "POST",
      url: `/api/v1/procurement/purchase-orders/${purchaseOrder.id}/supplier-invoices`,
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        supplierInvoiceNumber: `INV-2-${suffix}`,
        lines: [{ purchaseOrderLineId, quantity: 6, unitPrice: 12.5 }],
      },
    });
    assert.equal(secondInvoice.statusCode, 201);

    const persisted = await db.query<{
      status: string;
      received_quantity: string;
      invoiced_quantity: string;
    }>(
      `
        SELECT po.status, pol.received_quantity, pol.invoiced_quantity
        FROM procurement.purchase_orders po
        INNER JOIN procurement.purchase_order_lines pol
          ON pol.company_id = po.company_id AND pol.purchase_order_id = po.id
        WHERE po.company_id = $1 AND po.id = $2
      `,
      [fixture.companyId, purchaseOrder.id],
    );
    assert.equal(persisted.rows[0].status, "RECEIVED");
    assert.equal(Number(persisted.rows[0].received_quantity), 10);
    assert.equal(Number(persisted.rows[0].invoiced_quantity), 10);

    const audit = await db.query<{ action: string }>(
      `
        SELECT action
        FROM core.audit_events
        WHERE company_id = $1
          AND action IN (
            'PURCHASE_REQUISITION_CREATED',
            'PURCHASE_REQUISITION_UPDATED',
            'PURCHASE_REQUISITION_SUBMITTED',
            'PURCHASE_ORDER_CREATED',
            'GOODS_RECEIPT_CREATED',
            'SUPPLIER_INVOICE_MATCHED'
          )
      `,
      [fixture.companyId],
    );
    assert.equal(audit.rowCount, 8);
  } finally {
    try {
      await app.close();
    } finally {
      try {
        await fixture.cleanup();
      } finally {
        await otherCompany.cleanup();
      }
    }
  }
});