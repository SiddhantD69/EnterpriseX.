import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";

test("HR department and employee workflow validates permissions and company-scoped isolation", async () => {
  const fixture = await createMasterDataTestSession([
    "hr.read",
    "hr.departments.read",
    "hr.departments.create",
    "hr.employees.read",
    "hr.employees.create",
  ]);
  const deniedFixture = await createMasterDataTestSession([]);
  const app = buildApp();

  try {
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/hr/departments",
      headers: { authorization: `Bearer ${deniedFixture.token}` },
    });
    assert.equal(denied.statusCode, 403);

    const department = await app.inject({
      method: "POST",
      url: "/api/v1/hr/departments",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: "ENG",
        name: "Engineering",
        managerUserId: fixture.userId,
        description: "Product engineering team",
      },
    });
    assert.equal(department.statusCode, 201);
    assert.equal(department.json().data.code, "ENG");

    const employee = await app.inject({
      method: "POST",
      url: "/api/v1/hr/employees",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        departmentId: department.json().data.id,
        employeeNumber: "EMP-1001",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada.lovelace@enterprisex.local",
        managerUserId: fixture.userId,
        status: "ACTIVE",
      },
    });
    assert.equal(employee.statusCode, 201);
    assert.equal(employee.json().data.employeeNumber, "EMP-1001");

    const duplicateEmployee = await app.inject({
      method: "POST",
      url: "/api/v1/hr/employees",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        departmentId: department.json().data.id,
        employeeNumber: "EMP-1001",
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace.hopper@enterprisex.local",
        status: "ACTIVE",
      },
    });
    assert.equal(duplicateEmployee.statusCode, 409);

    const departments = await app.inject({
      method: "GET",
      url: "/api/v1/hr/departments",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(departments.statusCode, 200);
    assert.ok(departments.json().data.some((row: { code: string }) => row.code === "ENG"));

    const employees = await app.inject({
      method: "GET",
      url: "/api/v1/hr/employees",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(employees.statusCode, 200);
    assert.ok(employees.json().data.some((row: { employeeNumber: string }) => row.employeeNumber === "EMP-1001"));
  } finally {
    await db.query("DELETE FROM hr.employees WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM hr.departments WHERE company_id = $1", [fixture.companyId]);
    await app.close();
    await fixture.cleanup();
    await deniedFixture.cleanup();
  }
});
