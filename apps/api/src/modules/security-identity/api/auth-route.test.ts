import assert from "node:assert/strict";
import test, {
  after,
  before,
  describe,
} from "node:test";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { hashSessionToken } from "../security/session-credential.js";
import { hashPassword } from "../security/password-hasher.js";

const TEST_EMAIL =
  `auth-route-test-${randomUUID()}@enterprisex.local`;

const TEST_PASSWORD =
  "EnterpriseX-Test-Password-123!";

const TEST_DISPLAY_NAME =
  "Authentication Route Test User";

let testUserId: string;

let organizationId: string;
let companyAId: string;
let companyBId: string;

const createTestUser = async (): Promise<void> => {
  const organizationResult =
    await db.query<{ id: string }>(
      `
        INSERT INTO core.organizations (
          code,
          name,
          status
        )
        VALUES (
          $1,
          $2,
          'ACTIVE'
        )
        RETURNING id
      `,
      [
        `AUTH-ORG-${randomUUID().slice(0, 8)}`,
        "Authentication Route Test Organization",
      ],
    );

  organizationId =
    organizationResult.rows[0].id;

  const companyAResult =
    await db.query<{ id: string }>(
      `
        INSERT INTO core.companies (
          organization_id,
          code,
          name,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          'ACTIVE'
        )
        RETURNING id
      `,
      [
        organizationId,
        `AUTH-A-${randomUUID().slice(0, 8)}`,
        "Authentication Test Company A",
      ],
    );

  companyAId =
    companyAResult.rows[0].id;

  const companyBResult =
    await db.query<{ id: string }>(
      `
        INSERT INTO core.companies (
          organization_id,
          code,
          name,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          'ACTIVE'
        )
        RETURNING id
      `,
      [
        organizationId,
        `AUTH-B-${randomUUID().slice(0, 8)}`,
        "Authentication Test Company B",
      ],
    );

  companyBId =
    companyBResult.rows[0].id;

  const userResult =
    await db.query<{ id: string }>(
      `
        INSERT INTO security.users (
          email,
          display_name,
          status
        )
        VALUES (
          $1,
          $2,
          'ACTIVE'
        )
        RETURNING id
      `,
      [
        TEST_EMAIL,
        TEST_DISPLAY_NAME,
      ],
    );

  testUserId =
    userResult.rows[0].id;

  const passwordHash =
    await hashPassword(
      TEST_PASSWORD,
    );

  await db.query(
    `
      INSERT INTO security.user_credentials (
        user_id,
        password_hash,
        password_changed_at,
        failed_login_attempts,
        locked_until
      )
      VALUES (
        $1,
        $2,
        NOW(),
        0,
        NULL
      )
    `,
    [
      testUserId,
      passwordHash,
    ],
  );
};

const clearCompanyAccess =
  async (): Promise<void> => {
    await db.query(
      `
        DELETE FROM security.user_company_access
        WHERE user_id = $1
      `,
      [testUserId],
    );
  };

const grantCompanyAccess =
  async (
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
        VALUES (
          $1,
          $2,
          $3,
          'ACTIVE'
        )
      `,
      [
        testUserId,
        organizationId,
        companyId,
      ],
    );
  };

const deleteTestUser =
  async (): Promise<void> => {
    await db.query(
      `
        DELETE FROM core.audit_events
        WHERE actor_user_id = $1
           OR entity_id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM security.sessions
        WHERE user_id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM security.user_roles
        WHERE user_id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM security.user_company_access
        WHERE user_id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM security.user_credentials
        WHERE user_id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM security.users
        WHERE id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM core.companies
        WHERE id IN ($1, $2)
      `,
      [
        companyAId,
        companyBId,
      ],
    );

    await db.query(
      `
        DELETE FROM core.organizations
        WHERE id = $1
      `,
      [organizationId],
    );
  };

describe(
  "POST /api/v1/auth/login",
  () => {
    let app: ReturnType<
      typeof buildApp
    >;

    before(async () => {
      await createTestUser();

      app = buildApp();

      await app.ready();
    });

    after(async () => {
      await app.close();

      await deleteTestUser();

      await db.end();
    });

    test(
      "logs in with valid credentials",
      async () => {
        await clearCompanyAccess();

        await grantCompanyAccess(
          companyAId,
        );

        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: TEST_EMAIL,
              password:
                TEST_PASSWORD,
            },
          });

        assert.equal(
          response.statusCode,
          200,
        );

        const body =
          response.json();

        assert.equal(
          body.user.email,
          TEST_EMAIL,
        );

        assert.equal(
          body.user.displayName,
          TEST_DISPLAY_NAME,
        );

        assert.equal(
          typeof body.user.id,
          "string",
        );

        assert.equal(
          typeof body.session.token,
          "string",
        );

        assert.ok(
          body.session.token
            .length > 0,
        );

        assert.ok(
          body.session.expiresAt,
        );

        assert.equal(
          body.companyContext.status,
          "SELECTED",
        );

        assert.equal(
          body.companyContext
            .organizationId,
          organizationId,
        );

        assert.equal(
          body.companyContext.companyId,
          companyAId,
        );

        assert.equal(
          "password" in
            body.user,
          false,
        );

        assert.equal(
          "passwordHash" in
            body.user,
          false,
        );
      },
    );

    test(
      "rejects an incorrect password",
      async () => {
        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: TEST_EMAIL,
              password:
                "Wrong-Password-123!",
            },
          });

        assert.equal(
          response.statusCode,
          401,
        );

        const body =
          response.json();

        assert.equal(
          body.error.code,
          "INVALID_CREDENTIALS",
        );

        assert.equal(
          body.error.message,
          "Invalid email or password.",
        );
      },
    );

    test(
      "rejects an unknown email",
      async () => {
        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email:
                "does-not-exist@enterprisex.local",
              password:
                TEST_PASSWORD,
            },
          });

        assert.equal(
          response.statusCode,
          401,
        );

        const body =
          response.json();

        assert.equal(
          body.error.code,
          "INVALID_CREDENTIALS",
        );

        assert.equal(
          body.error.message,
          "Invalid email or password.",
        );
      },
    );

    test(
      "rejects a request with missing credentials",
      async () => {
        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {},
          });

        assert.equal(
          response.statusCode,
          401,
        );

        const body =
          response.json();

        assert.equal(
          body.error.code,
          "INVALID_CREDENTIALS",
        );
      },
    );

    test(
      "rejects a JSON request body with invalid field types",
      async () => {
        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: 12345,
              password: true,
            },
          });

        assert.equal(
          response.statusCode,
          401,
        );

        const body =
          response.json();

        assert.equal(
          body.error.code,
          "INVALID_CREDENTIALS",
        );

        assert.equal(
          body.error.message,
          "Invalid email or password.",
        );
      },
    );

    test(
      "automatically selects the only accessible company",
      async () => {
        await clearCompanyAccess();

        await grantCompanyAccess(
          companyAId,
        );

        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: TEST_EMAIL,
              password:
                TEST_PASSWORD,
            },
          });

        assert.equal(
          response.statusCode,
          200,
        );

        const body =
          response.json();

        assert.equal(
          body.companyContext.status,
          "SELECTED",
        );

        assert.equal(
          body.companyContext
            .companyId,
          companyAId,
        );

        const sessionResult =
          await db.query<{
            company_id: string | null;
          }>(
            `
              SELECT
                company_id
              FROM security.sessions
              WHERE user_id = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [testUserId],
          );

        assert.equal(
          sessionResult.rowCount,
          1,
        );

        assert.equal(
          sessionResult.rows[0]
            .company_id,
          companyAId,
        );
      },
    );

    test(
      "requires company selection when multiple companies are accessible",
      async () => {
        await clearCompanyAccess();

        await grantCompanyAccess(
          companyAId,
        );

        await grantCompanyAccess(
          companyBId,
        );

        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: TEST_EMAIL,
              password:
                TEST_PASSWORD,
            },
          });

        assert.equal(
          response.statusCode,
          200,
        );

        const body =
          response.json();

        assert.equal(
          body.companyContext.status,
          "SELECTION_REQUIRED",
        );

        assert.equal(
          body.companyContext
            .organizationId,
          null,
        );

        assert.equal(
          body.companyContext
            .companyId,
          null,
        );

        const sessionResult =
          await db.query<{
            company_id: string | null;
          }>(
            `
              SELECT
                company_id
              FROM security.sessions
              WHERE user_id = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [testUserId],
          );

        assert.equal(
          sessionResult.rowCount,
          1,
        );

        assert.equal(
          sessionResult.rows[0]
            .company_id,
          null,
        );
      },
    );

    test(
      "creates a session without company context when there is no company access",
      async () => {
        await clearCompanyAccess();

        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: TEST_EMAIL,
              password:
                TEST_PASSWORD,
            },
          });

        assert.equal(
          response.statusCode,
          200,
        );

        const body =
          response.json();

        assert.equal(
          body.companyContext.status,
          "NO_COMPANY_ACCESS",
        );

        assert.equal(
          body.companyContext
            .organizationId,
          null,
        );

        assert.equal(
          body.companyContext
            .companyId,
          null,
        );

        const sessionResult =
          await db.query<{
            company_id: string | null;
          }>(
            `
              SELECT
                company_id
              FROM security.sessions
              WHERE user_id = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [testUserId],
          );

        assert.equal(
          sessionResult.rowCount,
          1,
        );

        assert.equal(
          sessionResult.rows[0]
            .company_id,
          null,
        );
      },
    );

    test(
      "creates a database session after successful login",
      async () => {
        await clearCompanyAccess();

        await grantCompanyAccess(
          companyAId,
        );

        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: TEST_EMAIL,
              password:
                TEST_PASSWORD,
            },
          });

        assert.equal(
          response.statusCode,
          200,
        );

        const body =
          response.json();

        const sessionResult =
          await db.query<{
            id: string;
            user_id: string;
            company_id:
              string | null;
            status: string;
            token_hash: string;
          }>(
            `
              SELECT
                id,
                user_id,
                company_id,
                status,
                token_hash
              FROM security.sessions
              WHERE user_id = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [testUserId],
          );

        assert.equal(
          sessionResult.rowCount,
          1,
        );

        const session =
          sessionResult.rows[0];

        assert.equal(
          session.user_id,
          testUserId,
        );

        assert.equal(
          session.company_id,
          companyAId,
        );

        assert.equal(
          session.status,
          "ACTIVE",
        );

        assert.equal(
          session.token_hash,
          hashSessionToken(
            body.session.token,
          ),
        );
      },
    );

    test(
      "records successful authentication audit events",
      async () => {
        await clearCompanyAccess();

        await grantCompanyAccess(
          companyAId,
        );

        const response =
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: {
              email: TEST_EMAIL,
              password:
                TEST_PASSWORD,
            },
          });

        assert.equal(
          response.statusCode,
          200,
        );

        const result =
          await db.query<{
            action: string;
            status: string;
            source_module: string;
          }>(
            `
              SELECT
                action,
                status,
                source_module
              FROM core.audit_events
              WHERE actor_user_id = $1
                AND action IN (
                  'LOGIN_SUCCESS',
                  'SESSION_CREATED'
                )
              ORDER BY occurred_at DESC
            `,
            [testUserId],
          );

        assert.ok(
          result.rows.some(
            (
              row: {
                action: string;
                status: string;
                source_module: string;
              },
            ) =>
              row.action ===
                "LOGIN_SUCCESS" &&
              row.status ===
                "SUCCESS" &&
              row.source_module ===
                "security-identity",
          ),
        );

        assert.ok(
          result.rows.some(
            (
              row: {
                action: string;
                status: string;
                source_module: string;
              },
            ) =>
              row.action ===
                "SESSION_CREATED" &&
              row.status ===
                "SUCCESS" &&
              row.source_module ===
                "security-identity",
          ),
        );
      },
    );
  },
);