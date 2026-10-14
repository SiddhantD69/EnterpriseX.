import { db } from "../../../../infrastructure/database/pool.js";
import type { PoolClient } from "pg";

import type {
  CreateWarehouseInput,
  MasterDataStatus,
  UpdateWarehouseInput,
  Warehouse,
} from "../domain/warehouse.js";

type WarehouseRow = {
  id: string;
  company_id: string;
  plant_id: string;
  code: string;
  name: string;
  warehouse_type: Warehouse["warehouseType"];
  status: MasterDataStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

const mapWarehouse = (row: WarehouseRow): Warehouse => ({
  id: row.id,
  companyId: row.company_id,
  plantId: row.plant_id,
  code: row.code,
  name: row.name,
  warehouseType: row.warehouse_type,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const warehouseColumns = `
  id,
  company_id,
  plant_id,
  code,
  name,
  warehouse_type,
  status,
  created_at,
  updated_at
`;

export const listWarehouses = async (
  companyId: string,
): Promise<Warehouse[]> => {
  const result = await db.query<WarehouseRow>(
    `
      SELECT ${warehouseColumns}
      FROM core.warehouses
      WHERE company_id = $1
      ORDER BY code ASC
    `,
    [companyId],
  );

  return result.rows.map(mapWarehouse);
};

export const findWarehouse = async (
  companyId: string,
  warehouseId: string,
): Promise<Warehouse | null> => {
  const result = await db.query<WarehouseRow>(
    `
      SELECT ${warehouseColumns}
      FROM core.warehouses
      WHERE company_id = $1
        AND id = $2
    `,
    [companyId, warehouseId],
  );

  return result.rows[0]
    ? mapWarehouse(result.rows[0])
    : null;
};

export const findPlantInCompany = async (
  client: PoolClient,
  companyId: string,
  plantId: string,
): Promise<boolean> => {
  const result = await client.query(
    `
      SELECT id
      FROM core.plants
      WHERE company_id = $1
        AND id = $2
    `,
    [companyId, plantId],
  );

  return result.rowCount === 1;
};

export const createWarehouse = async (
  client: PoolClient,
  companyId: string,
  input: CreateWarehouseInput,
): Promise<Warehouse> => {
  const result = await client.query<WarehouseRow>(
    `
      INSERT INTO core.warehouses (
        company_id,
        plant_id,
        code,
        name,
        warehouse_type
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${warehouseColumns}
    `,
    [
      companyId,
      input.plantId,
      input.code,
      input.name,
      input.warehouseType,
    ],
  );

  return mapWarehouse(result.rows[0]);
};

export const updateWarehouse = async (
  client: PoolClient,
  companyId: string,
  warehouseId: string,
  input: UpdateWarehouseInput,
): Promise<Warehouse | null> => {
  const result = await client.query<WarehouseRow>(
    `
      UPDATE core.warehouses
      SET
        plant_id = $1,
        code = $2,
        name = $3,
        warehouse_type = $4,
        status = $5,
        updated_at = NOW()
      WHERE company_id = $6
        AND id = $7
      RETURNING ${warehouseColumns}
    `,
    [
      input.plantId,
      input.code,
      input.name,
      input.warehouseType,
      input.status,
      companyId,
      warehouseId,
    ],
  );

  return result.rows[0]
    ? mapWarehouse(result.rows[0])
    : null;
};