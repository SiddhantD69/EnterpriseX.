import { randomUUID } from "node:crypto";

import { db } from "../../../../infrastructure/database/pool.js";
import { createSession } from "../../../security-identity/infrastructure/session-repository.js";
import { hashSessionToken } from "../../../security-identity/security/session-credential.js";

export const createMasterDataTestSession = async (
  permissionCodes: string[],
) => {
  const suffix = randomUUID().slice(0, 8);
  const token = `master-data-test-${suffix}`;
  const created: {
    organizationId?: string;
    companyId?: string;
    userId?: string;
    roleId?: string;
    permissionIds: string[];
    currencyCodes: string[];
    unitCodes: string[];
    plantCodes: string[];
    warehouseCodes: string[];
    storageLocationCodes: string[];
    sessionId?: string;
  } = {
    permissionIds: [],
    currencyCodes: [],
    unitCodes: [],
    plantCodes: [],
    warehouseCodes: [],
    storageLocationCodes: [],
  };

  const cleanup = async (): Promise<void> => {
    if (created.companyId) {
      await db.query(
        "DELETE FROM core.audit_events WHERE company_id = $1",
        [created.companyId],
      );
      await db.query(
        "DELETE FROM inventory.stock_movements WHERE company_id = $1",
        [created.companyId],
      );
      await db.query(
        "DELETE FROM inventory.stock_balances WHERE company_id = $1",
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM procurement.supplier_invoice_lines
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM procurement.supplier_invoices
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM inventory.goods_receipt_lines
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM inventory.goods_receipts
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM procurement.purchase_order_lines
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM procurement.purchase_orders
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM procurement.requisition_lines
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        `
          DELETE FROM procurement.requisitions
          WHERE company_id = $1
        `,
        [created.companyId],
      );
      await db.query(
        "DELETE FROM core.materials WHERE company_id = $1",
        [created.companyId],
      );
      await db.query(
        "DELETE FROM core.suppliers WHERE company_id = $1",
        [created.companyId],
      );
      await db.query(
        "DELETE FROM core.document_number_sequences WHERE company_id = $1",
        [created.companyId],
      );

      if (created.storageLocationCodes.length > 0) {
        await db.query(
          `
            DELETE FROM core.audit_events
            WHERE company_id = $1
              AND action IN ('STORAGE_LOCATION_CREATED', 'STORAGE_LOCATION_UPDATED')
              AND entity_type = 'STORAGE_LOCATION'
              AND source_module = 'core-platform'
              AND entity_id IN (
                SELECT id
                FROM core.storage_locations
                WHERE company_id = $1
                  AND code = ANY($2::varchar[])
              )
          `,
          [created.companyId, created.storageLocationCodes],
        );
        await db.query(
          `
            DELETE FROM core.storage_locations
            WHERE company_id = $1
              AND code = ANY($2::varchar[])
          `,
          [created.companyId, created.storageLocationCodes],
        );
      }

      if (created.warehouseCodes.length > 0) {
        await db.query(
          `
            DELETE FROM core.audit_events
            WHERE company_id = $1
              AND action IN ('WAREHOUSE_CREATED', 'WAREHOUSE_UPDATED')
              AND entity_type = 'WAREHOUSE'
              AND source_module = 'core-platform'
              AND entity_id IN (
                SELECT id
                FROM core.warehouses
                WHERE company_id = $1
                  AND code = ANY($2::varchar[])
              )
          `,
          [created.companyId, created.warehouseCodes],
        );
        await db.query(
          `
            DELETE FROM core.warehouses
            WHERE company_id = $1
              AND code = ANY($2::varchar[])
          `,
          [created.companyId, created.warehouseCodes],
        );
      }

      if (created.plantCodes.length > 0) {
        await db.query(
          `
            DELETE FROM core.audit_events
            WHERE company_id = $1
              AND action IN ('PLANT_CREATED', 'PLANT_UPDATED')
              AND entity_type = 'PLANT'
              AND source_module = 'core-platform'
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

    for (const code of created.currencyCodes) {
      await db.query(
        `
          DELETE FROM core.currencies
          WHERE code = $1
            AND NOT EXISTS (
              SELECT 1 FROM procurement.purchase_orders WHERE currency_code = $1
            )
        `,
        [code],
      );
    }

    for (const code of created.unitCodes) {
      await db.query(
        `
          DELETE FROM core.units_of_measure
          WHERE code = $1
            AND NOT EXISTS (
              SELECT 1 FROM core.materials WHERE base_unit_code = $1
            )
            AND NOT EXISTS (
              SELECT 1 FROM procurement.requisition_lines WHERE unit_code = $1
            )
            AND NOT EXISTS (
              SELECT 1 FROM procurement.purchase_order_lines WHERE unit_code = $1
            )
        `,
        [code],
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
      [`MD-ORG-${suffix}`, "Master Data Test Organization"],
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
      [created.organizationId, `MD-CO-${suffix}`, "Master Data Test Company"],
    );
    created.companyId = company.rows[0].id;

    const user = await db.query<{ id: string }>(
      `
        INSERT INTO security.users (email, display_name, status)
        VALUES ($1, $2, 'ACTIVE')
        RETURNING id
      `,
      [`master-data-${suffix}@enterprisex.local`, "Master Data Test User"],
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
      [`MD_ROLE_${suffix}`, "Master Data Test Role"],
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

      assertPermissionExists(permission.rowCount, permissionCode);

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
      trackPlantCode: (code: string) => created.plantCodes.push(code),
      trackWarehouseCode: (code: string) => created.warehouseCodes.push(code),
      trackStorageLocationCode: (code: string) =>
        created.storageLocationCodes.push(code),
      trackCurrencyCode: (code: string) => created.currencyCodes.push(code),
      trackUnitCode: (code: string) => created.unitCodes.push(code),
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
};

const assertPermissionExists = (
  rowCount: number | null,
  permissionCode: string,
): void => {
  if (rowCount !== 1) {
    throw new Error(
      `${permissionCode} permission must be available.`,
    );
  }
};