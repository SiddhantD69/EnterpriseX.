import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { db } from "../../../infrastructure/database/pool.js";
import { createSession } from "./session-repository.js";
import { hashSessionToken } from "../security/session-credential.js";
import {
  findAuthenticatedContextBySessionId,
} from "./authenticated-context-repository.js";

type TestFixture = {
  userId: string;
  roleId: string;
  permissionId: string;
  organizationId: string;
  companyId: string;
};

const createFixture = async (): Promise<TestFixture> => {
  const suffix = randomUUID().slice(0, 8);

  /*
   * Organization
   */
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
        `CTX-ORG-${suffix}`,
        "Context Test Organization",
      ],
    );

  const organizationId =
    organizationResult.rows[0].id;

  /*
   * Company
   */
  const companyResult =
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
        `CTX-CO-${suffix}`,
        "Context Test Company",
      ],
    );

  const companyId =
    companyResult.rows[0].id;

  /*
   * User
   */
  const email =
    `context-test-${suffix}@enterprisex.local`;

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
        email,
        "Context Test User",
      ],
    );

  const userId =
    userResult.rows[0].id;

  /*
   * User → Company Access
   */
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
      userId,
      organizationId,
      companyId,
    ],
  );

  /*
   * Permission
   */
  const permissionResult =
    await db.query<{ id: string }>(
      `
        INSERT INTO security.permissions (
          code,
          name
        )
        VALUES (
          $1,
          $2
        )
        RETURNING id
      `,
      [
        `context.test.${suffix}`,
        "Context Test Permission",
      ],
    );

  const permissionId =
    permissionResult.rows[0].id;

  /*
   * Role
   */
  const roleResult =
    await db.query<{ id: string }>(
      `
        INSERT INTO security.roles (
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
        `CTX_ROLE_${suffix}`,
        "Context Test Role",
      ],
    );

  const roleId =
    roleResult.rows[0].id;

  /*
   * Role → Permission
   */
  await db.query(
    `
      INSERT INTO security.role_permissions (
        role_id,
        permission_id
      )
      VALUES (
        $1,
        $2
      )
    `,
    [
      roleId,
      permissionId,
    ],
  );

  /*
   * User → Role → Company
   */
  await db.query(
    `
      INSERT INTO security.user_roles (
        user_id,
        role_id,
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
      userId,
      roleId,
      companyId,
    ],
  );

  return {
    userId,
    roleId,
    permissionId,
    organizationId,
    companyId,
  };
};

const cleanupFixture = async (
  fixture: TestFixture,
): Promise<void> => {
  await db.query(
    `
      DELETE FROM security.sessions
      WHERE user_id = $1
    `,
    [fixture.userId],
  );

  await db.query(
    `
      DELETE FROM core.audit_events
      WHERE actor_user_id = $1
         OR entity_id = $1
    `,
    [fixture.userId],
  );

  await db.query(
    `
      DELETE FROM security.user_roles
      WHERE user_id = $1
    `,
    [fixture.userId],
  );

  await db.query(
    `
      DELETE FROM security.user_company_access
      WHERE user_id = $1
    `,
    [fixture.userId],
  );

  await db.query(
    `
      DELETE FROM security.user_credentials
      WHERE user_id = $1
    `,
    [fixture.userId],
  );

  await db.query(
    `
      DELETE FROM security.users
      WHERE id = $1
    `,
    [fixture.userId],
  );

  await db.query(
    `
      DELETE FROM security.role_permissions
      WHERE role_id = $1
    `,
    [fixture.roleId],
  );

  await db.query(
    `
      DELETE FROM security.roles
      WHERE id = $1
    `,
    [fixture.roleId],
  );

  await db.query(
    `
      DELETE FROM security.permissions
      WHERE id = $1
    `,
    [fixture.permissionId],
  );

  await db.query(
    `
      DELETE FROM core.companies
      WHERE id = $1
    `,
    [fixture.companyId],
  );

  await db.query(
    `
      DELETE FROM core.organizations
      WHERE id = $1
    `,
    [fixture.organizationId],
  );
};

test("Authenticated Context Repository", async (t) => {
  await t.test(
    "resolves session, user, company, organization, roles, and permissions",
    async () => {
      const fixture =
        await createFixture();

      try {
        const suffix =
          fixture.companyId.slice(0, 8);

        const token =
          `context-test-token-${suffix}`;

        /*
         * The session MUST explicitly carry
         * the company context.
         */
        const session =
          await createSession({
            userId:
              fixture.userId,
            companyId:
              fixture.companyId,
            tokenHash:
              hashSessionToken(token),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          });

        const context =
          await findAuthenticatedContextBySessionId(
            session.id,
          );

        assert.ok(context);

        /*
         * Session
         */
        assert.equal(
          context.sessionId,
          session.id,
        );

        /*
         * User
         */
        assert.equal(
          context.user.userId,
          fixture.userId,
        );

        assert.equal(
          context.user.email.endsWith(
            "@enterprisex.local",
          ),
          true,
        );

        assert.equal(
          context.user.displayName,
          "Context Test User",
        );

        /*
         * Organization
         */
        assert.equal(
          context.organization.id,
          fixture.organizationId,
        );

        assert.equal(
          context.organization.code.startsWith(
            "CTX-ORG-",
          ),
          true,
        );

        assert.equal(
          context.organization.name,
          "Context Test Organization",
        );

        /*
         * Company
         */
        assert.equal(
          context.company.id,
          fixture.companyId,
        );

        assert.equal(
          context.company.code.startsWith(
            "CTX-CO-",
          ),
          true,
        );

        assert.equal(
          context.company.name,
          "Context Test Company",
        );

        /*
         * Role
         */
        assert.equal(
          context.roles.length,
          1,
        );

        assert.equal(
          context.roles[0].id,
          fixture.roleId,
        );

        assert.equal(
          context.roles[0].code.startsWith(
            "CTX_ROLE_",
          ),
          true,
        );

        assert.equal(
          context.roles[0].name,
          "Context Test Role",
        );

        /*
         * Permission
         */
        assert.equal(
          context.permissions.length,
          1,
        );

        assert.equal(
          context.permissions[0].code.startsWith(
            "context.test.",
          ),
          true,
        );

        assert.equal(
          context.permissions[0].name,
          "Context Test Permission",
        );
      } finally {
        await cleanupFixture(fixture);
      }
    },
  );

  await t.test(
    "uses the company stored on the session and does not leak another accessible company",
    async () => {
      const fixture =
        await createFixture();

      let secondCompanyId:
        string | null = null;

      let secondSessionId:
        string | null = null;

      try {
        /*
         * Create another active company
         * under the same organization.
         */
        const secondCompanyResult =
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
              fixture.organizationId,
              `CTX-CO2-${randomUUID().slice(0, 8)}`,
              "Context Test Company Two",
            ],
          );

        secondCompanyId =
          secondCompanyResult.rows[0].id;

        /*
         * Give the same user access
         * to the second company.
         */
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
            fixture.userId,
            fixture.organizationId,
            secondCompanyId,
          ],
        );

        /*
         * Session remains scoped to
         * the ORIGINAL company.
         */
        const token =
          `context-company-scope-${randomUUID()}`;

        const scopedSession =
          await createSession({
            userId:
              fixture.userId,
            companyId:
              fixture.companyId,
            tokenHash:
              hashSessionToken(token),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          });

        secondSessionId =
          scopedSession.id;

        const context =
          await findAuthenticatedContextBySessionId(
            scopedSession.id,
          );

        assert.ok(context);

        /*
         * Session company is authoritative.
         */
        assert.equal(
          context.company.id,
          fixture.companyId,
        );

        /*
         * Second accessible company
         * must never leak into context.
         */
        assert.notEqual(
          context.company.id,
          secondCompanyId,
        );
      } finally {
        if (secondSessionId) {
          await db.query(
            `
              DELETE FROM security.sessions
              WHERE id = $1
            `,
            [secondSessionId],
          );
        }

        if (secondCompanyId) {
          await db.query(
            `
              DELETE FROM security.user_company_access
              WHERE user_id = $1
                AND company_id = $2
            `,
            [
              fixture.userId,
              secondCompanyId,
            ],
          );

          await db.query(
            `
              DELETE FROM core.companies
              WHERE id = $1
            `,
            [secondCompanyId],
          );
        }

        await cleanupFixture(fixture);
      }
    },
  );

  await t.test(
    "does not resolve a company when the session has no company context",
    async () => {
      const fixture =
        await createFixture();

      try {
        const token =
          `context-no-company-${randomUUID()}`;

        const session =
          await createSession({
            userId:
              fixture.userId,
            companyId:
              null,
            tokenHash:
              hashSessionToken(token),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          });

        const context =
          await findAuthenticatedContextBySessionId(
            session.id,
          );

        /*
         * The repository must NOT guess
         * a company from user access.
         */
        assert.equal(
          context,
          null,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    },
  );

  await t.test(
    "returns null when the session is revoked",
    async () => {
      const fixture =
        await createFixture();

      try {
        const token =
          `context-revoked-${randomUUID()}`;

        const session =
          await createSession({
            userId:
              fixture.userId,
            companyId:
              fixture.companyId,
            tokenHash:
              hashSessionToken(token),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          });

        await db.query(
          `
            UPDATE security.sessions
            SET
              status = 'REVOKED',
              revoked_at = NOW()
            WHERE id = $1
          `,
          [session.id],
        );

        const context =
          await findAuthenticatedContextBySessionId(
            session.id,
          );

        assert.equal(
          context,
          null,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    },
  );

  await t.test(
    "returns null for an unknown session",
    async () => {
      const context =
        await findAuthenticatedContextBySessionId(
          randomUUID(),
        );

      assert.equal(
        context,
        null,
      );
    },
  );

  await db.end();
});