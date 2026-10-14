import { db } from "../../../../infrastructure/database/pool.js";
import type { PoolClient } from "pg";

import type {
  CreateStorageLocationInput,
  StorageLocation,
  UpdateStorageLocationInput,
} from "../domain/storage-location.js";
import type { MasterDataStatus } from "../domain/warehouse.js";

type StorageLocationRow = {
  id: string;
  company_id: string;
  warehouse_id: string;
  code: string;
  name: string;
  status: MasterDataStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

const mapStorageLocation = (
  row: StorageLocationRow,
): StorageLocation => ({
  id: row.id,
  companyId: row.company_id,
  warehouseId: row.warehouse_id,
  code: row.code,
  name: row.name,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const storageLocationColumns = `
  id,
  company_id,
  warehouse_id,
  code,
  name,
  status,
  created_at,
  updated_at
`;

export const listStorageLocations = async (
  companyId: string,
): Promise<StorageLocation[]> => {
  const result = await db.query<StorageLocationRow>(
    `
      SELECT ${storageLocationColumns}
      FROM core.storage_locations
      WHERE company_id = $1
      ORDER BY warehouse_id ASC, code ASC
    `,
    [companyId],
  );

  return result.rows.map(mapStorageLocation);
};

export const findStorageLocation = async (
  companyId: string,
  storageLocationId: string,
): Promise<StorageLocation | null> => {
  const result = await db.query<StorageLocationRow>(
    `
      SELECT ${storageLocationColumns}
      FROM core.storage_locations
      WHERE company_id = $1
        AND id = $2
    `,
    [companyId, storageLocationId],
  );

  return result.rows[0]
    ? mapStorageLocation(result.rows[0])
    : null;
};

export const findWarehouseInCompany = async (
  client: PoolClient,
  companyId: string,
  warehouseId: string,
): Promise<boolean> => {
  const result = await client.query(
    `
      SELECT id
      FROM core.warehouses
      WHERE company_id = $1
        AND id = $2
    `,
    [companyId, warehouseId],
  );

  return result.rowCount === 1;
};

export const createStorageLocation = async (
  client: PoolClient,
  companyId: string,
  input: CreateStorageLocationInput,
): Promise<StorageLocation> => {
  const result = await client.query<StorageLocationRow>(
    `
      INSERT INTO core.storage_locations (
        company_id,
        warehouse_id,
        code,
        name
      )
      VALUES ($1, $2, $3, $4)
      RETURNING ${storageLocationColumns}
    `,
    [companyId, input.warehouseId, input.code, input.name],
  );

  return mapStorageLocation(result.rows[0]);
};

export const updateStorageLocation = async (
  client: PoolClient,
  companyId: string,
  storageLocationId: string,
  input: UpdateStorageLocationInput,
): Promise<StorageLocation | null> => {
  const result = await client.query<StorageLocationRow>(
    `
      UPDATE core.storage_locations
      SET
        warehouse_id = $1,
        code = $2,
        name = $3,
        status = $4,
        updated_at = NOW()
      WHERE company_id = $5
        AND id = $6
      RETURNING ${storageLocationColumns}
    `,
    [
      input.warehouseId,
      input.code,
      input.name,
      input.status,
      companyId,
      storageLocationId,
    ],
  );

  return result.rows[0]
    ? mapStorageLocation(result.rows[0])
    : null;
};