import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";

test("Sales customer and order workflow validates access, company isolation, and order totals", async () => {
  const fixture = await createMasterDataTestSession([
    "sales.customers.read",
    "sales.customers.create",
    "sales.orders.read",
    "sales.orders.create",
  ]);
  const deniedFixture = await createMasterDataTestSession([]);
  const app = buildApp();

  try {
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/sales/customers",
      headers: { authorization: `Bearer ${deniedFixture.token}` },
    });
    assert.equal(denied.statusCode, 403);

    const createCustomer = await app.inject({
      method: "POST",
      url: "/api/v1/sales/customers",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: "CUST-1001",
        name: "Northwind Trading",
        customerType: "B2B",
        email: "sales@northwind.example",
        phone: "+1-555-0100",
      },
    });
    assert.equal(createCustomer.statusCode, 201);
    assert.equal(createCustomer.json().data.code, "CUST-1001");

    const duplicateCustomer = await app.inject({
      method: "POST",
      url: "/api/v1/sales/customers",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: "CUST-1001",
        name: "Duplicate Trading",
        customerType: "B2B",
      },
    });
    assert.equal(duplicateCustomer.statusCode, 409);

    const invalidOrder = await app.inject({
      method: "POST",
      url: "/api/v1/sales/orders",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        customerCode: "CUST-1001",
        description: "Bad order",
        lines: [{ description: "Widget", quantity: 0, unitPrice: 120 }],
      },
    });
    assert.equal(invalidOrder.statusCode, 400);

    const order = await app.inject({
      method: "POST",
      url: "/api/v1/sales/orders",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        customerCode: "CUST-1001",
        description: "Quarterly supply order",
        lines: [
          { description: "Widget A", quantity: 2, unitPrice: 125.5 },
          { description: "Widget B", quantity: 3, unitPrice: 89.25 },
        ],
      },
    });
    assert.equal(order.statusCode, 201);
    assert.equal(order.json().data.totalAmount, 2 * 125.5 + 3 * 89.25);

    const orderList = await app.inject({
      method: "GET",
      url: "/api/v1/sales/orders",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(orderList.statusCode, 200);
    assert.ok(orderList.json().data.some((row: { customerCode: string }) => row.customerCode === "CUST-1001"));
  } finally {
    await db.query("DELETE FROM sales.sales_order_lines WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM sales.sales_orders WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM sales.customers WHERE company_id = $1", [fixture.companyId]);
    await fixture.cleanup();
    await deniedFixture.cleanup();
  }
});
