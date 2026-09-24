import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  after,
  before,
  test,
} from "node:test";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import {
  findAuthenticatedContextBySessionId,
} from "../infrastructure/authenticated-context-repository.js";
import {
  createSession,
} from "../infrastructure/session-repository.js";
import {
  hashSessionToken,
} from "../security/session-credential.js";

type Fixture = {
  userId: string;
  activeOrganizationId: string;
  inactiveOrganizationId: string;
  companyAId: string;
  companyBId: string;
  inactiveCompanyId: string;
  inactiveOrganizationCompanyId: string;
  inactiveAccessCompanyId: string;
};

const app = buildApp();
let fixture: Fixture;

const createFixture = async (): Promise<Fixture> => {
  const suffix = randomUUID().slice(0, 8);

  const activeOrganization = await db.query<{ id: string }>(
    `
      INSERT INTO core.organizations (code, name, status)
      VALUES ($1, $2, 'ACTIVE')
      RETURNING id
    `,
    [
      `COMPANY-API-ORG-${suffix}`,
      "Company Context API Organization",
    ],
  );

  const inactiveOrganization = await db.query<{ id: string }>(
    `
      INSERT INTO core.organizations (code, name, status)
      VALUES ($1, $2, 'INACTIVE')
      RETURNING id
    `,
    [
      `COMPANY-API-INACTIVE-ORG-${suffix}`,
      "Inactive Company Context API Organization",
    ],
  );

  const createCompany = async (
    organizationId: string,
    code: string,
    status: "ACTIVE" | "INACTIVE",
  ): Promise<string> => {
    const result = await db.query<{ id: string }>(
      `
        INSERT INTO core.companies (
          organization_id,
          code,
          name,
          status
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        organizationId,
        code,
        `Company Context API ${code}`,
        status,
      ],
    );

    return result.rows[0].id;
  };

  const activeOrganizationId =
    activeOrganization.rows[0].id;
  const inactiveOrganizationId =
    inactiveOrganization.rows[0].id;
  const companyAId = await createCompany(
    activeOrganizationId,
    `COMPANY-API-A-${suffix}`,
    "ACTIVE",
  );
  const companyBId = await createCompany(
    activeOrganizationId,
    `COMPANY-API-B-${suffix}`,
    "ACTIVE",
  );
  const inactiveCompanyId = await createCompany(
    activeOrganizationId,
    `COMPANY-API-INACTIVE-${suffix}`,
    "INACTIVE",
  );
  const inactiveOrganizationCompanyId = await createCompany(
    inactiveOrganizationId,
    `COMPANY-API-ORG-INACTIVE-${suffix}`,
    "ACTIVE",
  );
  const inactiveAccessCompanyId = await createCompany(
    activeOrganizationId,
    `COMPANY-API-INACTIVE-ACCESS-${suffix}`,
    "ACTIVE",
  );

  const user = await db.query<{ id: string }>(
    `
      INSERT INTO security.users (
        email,
        display_name,
        status
      )
      VALUES ($1, $2, 'ACTIVE')
      RETURNING id
    `,
    [
      `company-context-api-${suffix}@enterprisex.local`,
      "Company Context API User",
    ],
  );

  const userId = user.rows[0].id;
  const grantAccess = async (
    organizationId: string,
    companyId: string,
  ): Promise<void> => {
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
      [userId, organizationId, companyId],
    );
  };

  await grantAccess(activeOrganizationId, companyAId);
  await grantAccess(activeOrganizationId, companyBId);
  await grantAccess(activeOrganizationId, inactiveCompanyId);
  await grantAccess(
    inactiveOrganizationId,
    inactiveOrganizationCompanyId,
  );
  await db.query(
    `
      INSERT INTO security.user_company_access (
        user_id,
        organization_id,
        company_id,
        status
      )
      VALUES ($1, $2, $3, 'INACTIVE')
    `,
    [userId, activeOrganizationId, inactiveAccessCompanyId],
  );

  return {
    userId,
    activeOrganizationId,
    inactiveOrganizationId,
    companyAId,
    companyBId,
    inactiveCompanyId,
    inactiveOrganizationCompanyId,
    inactiveAccessCompanyId,
  };
};

const createTestSession = async (
  companyId: string | null = null,
) => {
  const token = `company-context-api-${randomUUID()}`;
  const session = await createSession({
    userId: fixture.userId,
    companyId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return { session, token };
};

const authorization = (token: string) => ({
  authorization: `Bearer ${token}`,
});

before(async () => {
  fixture = await createFixture();
  await app.ready();
});

after(async () => {
  await app.close();

  if (!fixture) {
    await db.end();
    return;
  }

  await db.query(
    "DELETE FROM core.audit_events WHERE actor_user_id = $1",
    [fixture.userId],
  );
  await db.query(
    "DELETE FROM security.sessions WHERE user_id = $1",
    [fixture.userId],
  );
  await db.query(
    "DELETE FROM security.user_company_access WHERE user_id = $1",
    [fixture.userId],
  );
  await db.query(
    "DELETE FROM security.users WHERE id = $1",
    [fixture.userId],
  );
  await db.query(
    "DELETE FROM core.companies WHERE organization_id IN ($1, $2)",
    [fixture.activeOrganizationId, fixture.inactiveOrganizationId],
  );
  await db.query(
    "DELETE FROM core.organizations WHERE id IN ($1, $2)",
    [fixture.activeOrganizationId, fixture.inactiveOrganizationId],
  );
  await db.end();
});

test("GET /api/v1/auth/companies requires a valid bearer session", async () => {
  for (const headers of [
    {},
    { authorization: "Basic session-token" },
    { authorization: "Bearer invalid-token" },
  ]) {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/companies",
      headers,
    });

    assert.equal(response.statusCode, 401);
    assert.equal(
      response.json().error.code,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const expired = await createTestSession();
  await db.query(
    `
      UPDATE security.sessions
      SET
        created_at = NOW() - INTERVAL '2 hours',
        expires_at = NOW() - INTERVAL '1 hour'
      WHERE id = $1
    `,
    [expired.session.id],
  );

  const expiredResponse = await app.inject({
    method: "GET",
    url: "/api/v1/auth/companies",
    headers: authorization(expired.token),
  });
  assert.equal(expiredResponse.statusCode, 401);

  const revoked = await createTestSession();
  await db.query(
    `
      UPDATE security.sessions
      SET status = 'REVOKED', revoked_at = NOW()
      WHERE id = $1
    `,
    [revoked.session.id],
  );

  const revokedResponse = await app.inject({
    method: "GET",
    url: "/api/v1/auth/companies",
    headers: authorization(revoked.token),
  });
  assert.equal(revokedResponse.statusCode, 401);
});

test("GET /api/v1/auth/companies returns only active accessible company contexts", async () => {
  const { token } = await createTestSession();
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/auth/companies",
    headers: authorization(token),
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    companies: Array<{
      organization: { id: string };
      company: { id: string };
    }>;
  };

  assert.deepEqual(
    body.companies.map((entry) => entry.company.id).sort(),
    [fixture.companyAId, fixture.companyBId].sort(),
  );
  assert.ok(
    body.companies.every(
      (entry) =>
        entry.organization.id === fixture.activeOrganizationId,
    ),
  );
  assert.ok(
    !body.companies.some(
      (entry) =>
        entry.company.id ===
        fixture.inactiveAccessCompanyId,
    ),
  );
});

test("POST /api/v1/auth/company-context validates authentication and companyId", async () => {
  const noSession = await app.inject({
    method: "POST",
    url: "/api/v1/auth/company-context",
    payload: { companyId: fixture.companyAId },
  });
  assert.equal(noSession.statusCode, 401);

  const malformedAuthorization = await app.inject({
    method: "POST",
    url: "/api/v1/auth/company-context",
    headers: { authorization: "Basic session-token" },
    payload: { companyId: fixture.companyAId },
  });
  assert.equal(malformedAuthorization.statusCode, 401);

  const invalidToken = await app.inject({
    method: "POST",
    url: "/api/v1/auth/company-context",
    headers: authorization("invalid-token"),
    payload: { companyId: fixture.companyAId },
  });
  assert.equal(invalidToken.statusCode, 401);

  const { token } = await createTestSession();
  for (const payload of [{}, { companyId: 42 }, { companyId: " " }]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/company-context",
      headers: authorization(token),
      payload,
    });
    assert.equal(response.statusCode, 400);
    assert.equal(
      response.json().error.code,
      "INVALID_COMPANY_CONTEXT",
    );
  }

  for (const companyId of [
    randomUUID(),
    fixture.inactiveCompanyId,
    fixture.inactiveOrganizationCompanyId,
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/company-context",
      headers: authorization(token),
      payload: { companyId },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(
      response.json().error.code,
      "COMPANY_CONTEXT_FORBIDDEN",
    );
  }

  const expired = await createTestSession();
  await db.query(
    `
      UPDATE security.sessions
      SET
        created_at = NOW() - INTERVAL '2 hours',
        expires_at = NOW() - INTERVAL '1 hour'
      WHERE id = $1
    `,
    [expired.session.id],
  );
  const expiredResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/company-context",
    headers: authorization(expired.token),
    payload: { companyId: fixture.companyAId },
  });
  assert.equal(expiredResponse.statusCode, 401);

  const revoked = await createTestSession();
  await db.query(
    `
      UPDATE security.sessions
      SET status = 'REVOKED', revoked_at = NOW()
      WHERE id = $1
    `,
    [revoked.session.id],
  );
  const revokedResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/company-context",
    headers: authorization(revoked.token),
    payload: { companyId: fixture.companyAId },
  });
  assert.equal(revokedResponse.statusCode, 401);
});

test("POST /api/v1/auth/company-context scopes the session to the selected company", async () => {
  const { session, token } = await createTestSession();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/company-context",
    headers: authorization(token),
    payload: { companyId: fixture.companyBId },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    companyContext: {
      status: "SELECTED",
      organizationId: fixture.activeOrganizationId,
      companyId: fixture.companyBId,
    },
    organization: {
      id: fixture.activeOrganizationId,
      code: response.json().organization.code,
      name: response.json().organization.name,
    },
    company: {
      id: fixture.companyBId,
      code: response.json().company.code,
      name: response.json().company.name,
    },
  });

  const storedSession = await db.query<{
    company_id: string | null;
  }>(
    "SELECT company_id FROM security.sessions WHERE id = $1",
    [session.id],
  );
  assert.equal(
    storedSession.rows[0].company_id,
    fixture.companyBId,
  );

  const context = await findAuthenticatedContextBySessionId(
    session.id,
  );
  assert.ok(context);
  assert.equal(context.company.id, fixture.companyBId);
  assert.notEqual(context.company.id, fixture.companyAId);

  const audit = await db.query<{
    action: string;
    company_id: string;
  }>(
    `
      SELECT action, company_id
      FROM core.audit_events
      WHERE entity_id = $1
      ORDER BY occurred_at DESC
      LIMIT 1
    `,
    [session.id],
  );
  assert.equal(audit.rows[0].action, "COMPANY_CONTEXT_SELECTED");
  assert.equal(audit.rows[0].company_id, fixture.companyBId);
});

test("authenticated context remains bound to the company stored on the session", async () => {
  const { session, token } = await createTestSession(
    fixture.companyAId,
  );
  const beforeSelection = await findAuthenticatedContextBySessionId(
    session.id,
  );
  assert.ok(beforeSelection);
  assert.equal(beforeSelection.company.id, fixture.companyAId);

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/auth/companies",
    headers: authorization(token),
  });
  assert.equal(response.statusCode, 200);

  const afterLookup = await findAuthenticatedContextBySessionId(
    session.id,
  );
  assert.ok(afterLookup);
  assert.equal(afterLookup.company.id, fixture.companyAId);
  assert.notEqual(afterLookup.company.id, fixture.companyBId);
});
