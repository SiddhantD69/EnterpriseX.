
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../../app.js";
import { db } from "../../../../infrastructure/database/pool.js";
import { createCompanyPlant } from "../application/plant-service.js";
import { createSession } from "../../../security-identity/infrastructure/session-repository.js";
import { hashSessionToken } from "../../../security-identity/security/session-credential.js";

const createPlantApiTestSession = async (
  permissionCodes: string[] = ["core.plants.create"],
) => {
  const suffix = randomUUID().slice(0, 8);
  const token = `plant-api-test-${suffix}`;
  const created: {
    organizationId?: string;
    companyId?: string;
    userId?: string;
    roleId?: string;
    permissionIds: string[];
    plantCodes: string[];
    sessionId?: string;
  } = {
    permissionIds: [],
    plantCodes: [],
  };

  const trackPlantCode = (code: string): void => {
    created.plantCodes.push(code);
  };

  const cleanup = async (): Promise<void> => {
    if (created.companyId && created.plantCodes.length > 0) {
      await db.query(
        `
          DELETE FROM core.audit_events
          WHERE company_id = $1
            AND action = 'PLANT_CREATED'
            AND entity_type = 'PLANT'
            AND source_module = 'core-platform'
            AND metadata ->> 'operation' = 'plant.create'
            AND entity_id IN (
              SELECT id
              FROM core.plants
              WHERE company_id = $1
                AND code = ANY($2::varchar[])
            )
        `,
        [created.companyId, created.plantCodes],
      );
      await db.query(
        `
          DELETE FROM core.plants
          WHERE company_id = $1
            AND code = ANY($2::varchar[])
        `,
        [created.companyId, created.plantCodes],
      );
    }

    if (created.sessionId) {
      await db.query(
        "DELETE FROM security.sessions WHERE id = $1",
        [created.sessionId],
      );
    }

    if (created.userId) {
      await db.query(
        "DELETE FROM security.user_roles WHERE user_id = $1",
        [created.userId],
      );
      await db.query(
        "DELETE FROM security.user_company_access WHERE user_id = $1",
        [created.userId],
      );
      await db.query(
        "DELETE FROM security.users WHERE id = $1",
        [created.userId],
      );
    }

    if (created.roleId) {
      await db.query(
        "DELETE FROM security.role_permissions WHERE role_id = $1",
        [created.roleId],
      );
      await db.query(
        "DELETE FROM security.roles WHERE id = $1",
        [created.roleId],
      );
    }

    for (const permissionId of created.permissionIds) {
      await db.query(
        `
          DELETE FROM security.permissions
          WHERE id = $1
            AND NOT EXISTS (
              SELECT 1
              FROM security.role_permissions
              WHERE permission_id = $1
            )
        `,
        [permissionId],
      );
    }

    if (created.companyId) {
      await db.query(
        "DELETE FROM core.companies WHERE id = $1",
        [created.companyId],
      );
    }

    if (created.organizationId) {
      await db.query(
        "DELETE FROM core.organizations WHERE id = $1",
        [created.organizationId],
      );
    }
  };

  try {
    const organization = await db.query<{ id: string }>(
      `
        INSERT INTO core.organizations (code, name, status)
        VALUES ($1, $2, 'ACTIVE')
        RETURNING id
      `,
      [`PLANT-API-ORG-${suffix}`, "Plant API Test Organization"],
    );
    created.organizationId = organization.rows[0].id;

    const company = await db.query<{ id: string }>(
      `
        INSERT INTO core.companies (
          organization_id,
          code,
          name,
          status
        )
        VALUES ($1, $2, $3, 'ACTIVE')
        RETURNING id
      `,
      [created.organizationId, `PLANT-API-${suffix}`, "Plant API Test Company"],
    );
    created.companyId = company.rows[0].id;

    const user = await db.query<{ id: string }>(
      `
        INSERT INTO security.users (email, display_name, status)
        VALUES ($1, $2, 'ACTIVE')
        RETURNING id
      `,
      [`plant-api-${suffix}@enterprisex.local`, "Plant API Test User"],
    );
    created.userId = user.rows[0].id;

    await db.query(
      `
        INSERT INTO security.user_company_access (
          user_id,
          organization_id,
          company_id,
          status
        )
        VALUES ($1, $2, $3, 'ACTIVE')
      `,
      [created.userId, created.organizationId, created.companyId],
    );

    const role = await db.query<{ id: string }>(
      `
        INSERT INTO security.roles (code, name, status)
        VALUES ($1, $2, 'ACTIVE')
        RETURNING id
      `,
      [`PLANT_API_ROLE_${suffix}`, "Plant API Test Role"],
    );
    created.roleId = role.rows[0].id;

    for (const permissionCode of permissionCodes) {
      let permission = await db.query<{ id: string }>(
        `
          INSERT INTO security.permissions (code, name)
          VALUES ($1, $1)
          ON CONFLICT (code) DO NOTHING
          RETURNING id
        `,
        [permissionCode],
      );

      if (permission.rowCount === 1) {
        created.permissionIds.push(permission.rows[0].id);
      } else {
        permission = await db.query<{ id: string }>(
          `
            SELECT id
            FROM security.permissions
            WHERE code = $1
          `,
          [permissionCode],
        );
      }

      assert.equal(
        permission.rowCount,
        1,
        `${permissionCode} permission must be available.`,
      );

      await db.query(
        `
          INSERT INTO security.role_permissions (role_id, permission_id)
          VALUES ($1, $2)
        `,
        [created.roleId, permission.rows[0].id],
      );
    }

    await db.query(
      `
        INSERT INTO security.user_roles (user_id, role_id, company_id, status)
        VALUES ($1, $2, $3, 'ACTIVE')
      `,
      [created.userId, created.roleId, created.companyId],
    );

    const session = await createSession({
      userId: created.userId,
      companyId: created.companyId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    created.sessionId = session.id;

    return {
      token,
      companyId: created.companyId,
      organizationId: created.organizationId,
      userId: created.userId,
      trackPlantCode,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
};

test("Plant API requires authentication to list plants", async () => {
  const app = buildApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/core/plants",
    });

    assert.equal(
      response.statusCode,
      401,
      `Expected 401, received ${response.statusCode}: ${response.body}`,
    );
  } finally {
    await app.close();
  }
});

test("Plant API requires authentication to create plants", async () => {
  const app = buildApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      payload: {
        code: "PLANT-TEST",
        name: "Test Plant",
      },
    });

    assert.equal(
      response.statusCode,
      401,
      `Expected 401, received ${response.statusCode}: ${response.body}`,
    );
  } finally {
    await app.close();
  }
});

test("Plant API requires core.plants.read to list plants", async () => {
  const fixture = await createPlantApiTestSession([
    "core.plants.create",
  ]);
  const app = buildApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN");
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Plant API requires core.plants.create to create plants", async () => {
  const fixture = await createPlantApiTestSession([
    "core.plants.read",
  ]);
  const code = `PLANT-${randomUUID()}`;
  fixture.trackPlantCode(code);
  const app = buildApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
      payload: {
        code,
        name: "Forbidden Plant",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN");
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Plant API reaches the list handler with core.plants.read", async () => {
  const fixture = await createPlantApiTestSession([
    "core.plants.read",
  ]);
  const app = buildApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: [] });
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Plant API hides database details when listing plants fails", async () => {
  const fixture = await createPlantApiTestSession([
    "core.plants.read",
  ]);
  const app = buildApp();
  const internalError = new Error(
    "sensitive database connection detail",
  );
  const originalQuery = db.query.bind(db) as unknown as (
    query: string,
    values?: unknown[],
  ) => Promise<unknown>;
  const queryOverride = (async (
    query: string,
    values?: unknown[],
  ) => {
    if (query.includes("FROM core.plants")) {
      throw internalError;
    }

    return originalQuery(query, values);
  }) as typeof db.query;

  Object.defineProperty(db, "query", {
    configurable: true,
    value: queryOverride,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.json(), {
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
    assert.equal(response.body.includes(internalError.message), false);
  } finally {
    try {
      await app.close();
    } finally {
      Reflect.deleteProperty(db, "query");
      await fixture.cleanup();
    }
  }
});

test("Plant API reaches the create handler with core.plants.create", async () => {
  const fixture = await createPlantApiTestSession([
    "core.plants.create",
  ]);
  const app = buildApp();
  const code = `PLANT-${randomUUID()}`;
  fixture.trackPlantCode(code);

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${fixture.token}`,
      },
      payload: {
        code,
        name: "Authorized Plant",
        addressLine1: "  100 Main Street  ",
        city: "  Example City  ",
        countryCode: "  us  ",
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.code, code);
    assert.equal(response.json().data.addressLine1, "100 Main Street");
    assert.equal(response.json().data.city, "Example City");
    assert.equal(response.json().data.countryCode, "US");
    assert.equal(
      response.json().data.companyId,
      fixture.companyId,
    );

    const auditResult = await db.query<{
      action: string;
      entity_type: string;
      entity_id: string;
      status: string;
      after_data: { code: string; name: string; status: string };
      metadata: { operation: string };
    }>(
      `
        SELECT action, entity_type, entity_id, status, after_data, metadata
        FROM core.audit_events
        WHERE company_id = $1
          AND entity_id = $2
          AND action = 'PLANT_CREATED'
      `,
      [fixture.companyId, response.json().data.id],
    );

    assert.equal(auditResult.rowCount, 1);
    assert.equal(auditResult.rows[0].entity_type, "PLANT");
    assert.equal(auditResult.rows[0].status, "SUCCESS");
    assert.deepEqual(auditResult.rows[0].after_data, {
      code,
      name: "Authorized Plant",
      status: "ACTIVE",
    });
    assert.deepEqual(auditResult.rows[0].metadata, {
      operation: "plant.create",
    });
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Plant API isolates listings and rejects client-supplied companyId", async () => {
  const firstCompany = await createPlantApiTestSession([
    "core.plants.read",
  ]);
  const secondCompany = await createPlantApiTestSession([
    "core.plants.create",
  ]);
  const app = buildApp();
  const code = `PLANT-${randomUUID()}`;
  secondCompany.trackPlantCode(code);

  try {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${secondCompany.token}`,
      },
      payload: {
        code,
        name: "Second Company Plant",
      },
    });
    assert.equal(created.statusCode, 201);

    const firstCompanyList = await app.inject({
      method: "GET",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${firstCompany.token}`,
      },
    });
    assert.equal(firstCompanyList.statusCode, 200);
    assert.deepEqual(firstCompanyList.json(), { data: [] });

    const attemptedOverrideCode = `PLANT-${randomUUID()}`;
    secondCompany.trackPlantCode(attemptedOverrideCode);
    const attemptedOverride = await app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${secondCompany.token}`,
      },
      payload: {
        code: attemptedOverrideCode,
        name: "Override Attempt",
        companyId: firstCompany.companyId,
      },
    });

    assert.equal(attemptedOverride.statusCode, 400);
    assert.deepEqual(attemptedOverride.json(), {
      error: "VALIDATION_ERROR",
      message: "The request contains an unsupported field.",
    });
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

test("Plant API rejects duplicate codes only within the same company", async () => {
  const firstCompany = await createPlantApiTestSession([
    "core.plants.create",
  ]);
  const secondCompany = await createPlantApiTestSession([
    "core.plants.create",
  ]);
  const app = buildApp();
  const code = `PLANT-${randomUUID()}`;
  firstCompany.trackPlantCode(code);
  secondCompany.trackPlantCode(code);

  const createFor = (token: string) =>
    app.inject({
      method: "POST",
      url: "/api/v1/core/plants",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        code,
        name: "Unique Plant",
      },
    });

  try {
    const first = await createFor(firstCompany.token);
    assert.equal(first.statusCode, 201);

    const duplicate = await createFor(firstCompany.token);
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().error, "PLANT_CODE_CONFLICT");

    const otherCompany = await createFor(secondCompany.token);
    assert.equal(otherCompany.statusCode, 201);
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

test("Plant creation rolls back when its audit insert fails", async () => {
  const fixture = await createPlantApiTestSession();
  const code = `PLANT-${randomUUID()}`;
  fixture.trackPlantCode(code);

  try {
    await assert.rejects(
      createCompanyPlant(
        fixture.companyId,
        {
          code,
          name: "Audit Failure Plant",
        },
        {
          actorUserId: randomUUID(),
          organizationId: fixture.organizationId,
        },
      ),
    );

    const plantResult = await db.query(
      `
        SELECT id
        FROM core.plants
        WHERE company_id = $1
          AND code = $2
      `,
      [fixture.companyId, code],
    );
    assert.equal(plantResult.rowCount, 0);

    const auditResult = await db.query(
      `
        SELECT id
        FROM core.audit_events
        WHERE company_id = $1
          AND action = 'PLANT_CREATED'
          AND after_data ->> 'code' = $2
      `,
      [fixture.companyId, code],
    );
    assert.equal(auditResult.rowCount, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("Plant creation preserves audit error and releases client when rollback fails", async () => {
  const originalError = new Error("original audit failure");
  const rollbackError = new Error("sensitive rollback failure");
  const executedQueries: string[] = [];
  const logMessages: string[] = [];
  let releasedWith: Error | boolean | undefined;
  const fakeClient = {
    query: async (query: string) => {
      executedQueries.push(query);

      if (query === "BEGIN") {
        return { rows: [], rowCount: 0 };
      }

      if (query.includes("INSERT INTO core.plants")) {
        return {
          rows: [
            {
              id: randomUUID(),
              company_id: randomUUID(),
              code: "PLANT-ROLLBACK-TEST",
              name: "Rollback Test Plant",
              address_line_1: null,
              address_line_2: null,
              city: null,
              state: null,
              postal_code: null,
              country_code: null,
              status: "ACTIVE",
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }

      if (query.includes("INSERT INTO core.audit_events")) {
        throw originalError;
      }

      if (query === "ROLLBACK") {
        throw rollbackError;
      }

      throw new Error("Unexpected test query.");
    },
    release: (error?: Error | boolean) => {
      releasedWith = error;
    },
  };
  const originalConnectDescriptor = Object.getOwnPropertyDescriptor(
    db,
    "connect",
  );

  Object.defineProperty(db, "connect", {
    configurable: true,
    value: async () => fakeClient,
  });

  try {
    await assert.rejects(
      createCompanyPlant(
        randomUUID(),
        {
          code: "PLANT-ROLLBACK-TEST",
          name: "Rollback Test Plant",
        },
        {
          actorUserId: randomUUID(),
          organizationId: randomUUID(),
          logger: {
            error: (message: string) => {
              logMessages.push(message);
            },
          },
        },
      ),
      (error) => error === originalError,
    );

    assert.ok(executedQueries.includes("ROLLBACK"));
    assert.equal(logMessages.length, 1);
    assert.equal(
      logMessages[0],
      "Database transaction rollback failed.",
    );
    assert.equal(logMessages.includes(rollbackError.message), false);
    assert.ok(releasedWith instanceof Error);
    assert.equal(
      releasedWith.message,
      "Database transaction rollback failed.",
    );
  } finally {
    if (originalConnectDescriptor) {
      Object.defineProperty(
        db,
        "connect",
        originalConnectDescriptor,
      );
    } else {
      Reflect.deleteProperty(db, "connect");
    }
  }
});

test("Plant API rejects malformed and unexpected request bodies", async () => {
  const fixture = await createPlantApiTestSession();
  const app = buildApp();

  try {
    const payloads: unknown[] = [
      null,
      [],
      {},
      { code: "PLANT-X", name: "X", companyId: randomUUID() },
    ];

    for (const payload of payloads) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/core/plants",
        headers: {
          authorization: `Bearer ${fixture.token}`,
          "content-type": "application/json",
        },
        payload: JSON.stringify(payload),
      });

      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error, "VALIDATION_ERROR");
    }
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Plant API enforces migration-aligned text length limits", async () => {
  const fixture = await createPlantApiTestSession();
  const app = buildApp();
  const invalidCases = [
    {
      field: "code",
      value: "C".repeat(51),
      message: "Plant code must not exceed 50 characters.",
    },
    {
      field: "name",
      value: "N".repeat(256),
      message: "Plant name must not exceed 255 characters.",
    },
    {
      field: "addressLine1",
      value: "A".repeat(256),
      message: "Address line 1 must not exceed 255 characters.",
    },
    {
      field: "addressLine2",
      value: "A".repeat(256),
      message: "Address line 2 must not exceed 255 characters.",
    },
    {
      field: "city",
      value: "C".repeat(101),
      message: "City must not exceed 100 characters.",
    },
    {
      field: "state",
      value: "S".repeat(101),
      message: "State must not exceed 100 characters.",
    },
    {
      field: "postalCode",
      value: "P".repeat(21),
      message: "Postal code must not exceed 20 characters.",
    },
    {
      field: "countryCode",
      value: "U".repeat(11),
      message: "Country code must not exceed 10 characters.",
    },
  ];

  try {
    for (const { field, value, message } of invalidCases) {
      const code = `PLANT-${randomUUID()}`;
      fixture.trackPlantCode(code);
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/core/plants",
        headers: {
          authorization: `Bearer ${fixture.token}`,
        },
        payload: {
          code,
          name: "Length Test Plant",
          [field]: value,
        },
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), {
        error: "VALIDATION_ERROR",
        message,
      });
    }
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Plant API rejects non-string create fields with a validation error", async () => {
  const fixture = await createPlantApiTestSession();
  const app = buildApp();
  const basePayload = {
    code: "PLANT-TEST",
    name: "Test Plant",
  };
  const invalidCases: Array<{
    field: string;
    value: unknown;
    message: string;
  }> = [
    {
      field: "code",
      value: 42,
      message: "Plant code must be a string.",
    },
    {
      field: "name",
      value: 42,
      message: "Plant name must be a string.",
    },
    {
      field: "addressLine1",
      value: 42,
      message: "Address line 1 must be a string.",
    },
    {
      field: "addressLine2",
      value: 42,
      message: "Address line 2 must be a string.",
    },
    {
      field: "city",
      value: 42,
      message: "City must be a string.",
    },
    {
      field: "state",
      value: 42,
      message: "State must be a string.",
    },
    {
      field: "postalCode",
      value: 42,
      message: "Postal code must be a string.",
    },
    {
      field: "countryCode",
      value: 42,
      message: "Country code must be a string.",
    },
  ];

  try {
    for (const { field, value, message } of invalidCases) {
      fixture.trackPlantCode(
        field === "code" ? String(value) : basePayload.code,
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/core/plants",
        headers: {
          authorization: `Bearer ${fixture.token}`,
        },
        payload: {
          ...basePayload,
          [field]: value,
        },
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), {
        error: "VALIDATION_ERROR",
        message,
      });
    }
  } finally {
    try {
      await app.close();
    } finally {
      await fixture.cleanup();
    }
  }
});
