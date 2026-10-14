import { db } from "../../../../infrastructure/database/pool.js";
import type { PoolClient } from "pg";

import type {
  CatalogStatus,
  Currency,
  Material,
  Supplier,
  UnitOfMeasure,
} from "../domain/catalog.js";

type SupplierRow = Supplier & {
  company_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  companyId: never;
  createdAt: never;
  updatedAt: never;
};

type MaterialRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  base_unit_code: string;
  status: CatalogStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

type CurrencyRow = {
  code: string;
  name: string;
  decimal_places: number;
  status: CatalogStatus;
};

type UnitRow = {
  code: string;
  name: string;
  decimal_places: number;
  status: CatalogStatus;
};

const mapSupplier = (row: SupplierRow): Supplier => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  name: row.name,
  email: row.email,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapMaterial = (row: MaterialRow): Material => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  name: row.name,
  baseUnitCode: row.base_unit_code,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapCurrency = (row: CurrencyRow): Currency => ({
  code: row.code,
  name: row.name,
  decimalPlaces: row.decimal_places,
  status: row.status,
});

const mapUnit = (row: UnitRow): UnitOfMeasure => ({
  code: row.code,
  name: row.name,
  decimalPlaces: row.decimal_places,
  status: row.status,
});

export const listSuppliers = async (companyId: string): Promise<Supplier[]> => {
  const result = await db.query<SupplierRow>(
    `
      SELECT id, company_id, code, name, email, status, created_at, updated_at
      FROM core.suppliers
      WHERE company_id = $1
      ORDER BY code
    `,
    [companyId],
  );
  return result.rows.map(mapSupplier);
};

export const createSupplier = async (
  client: PoolClient,
  companyId: string,
  input: { code: string; name: string; email: string | null },
): Promise<Supplier> => {
  const result = await client.query<SupplierRow>(
    `
      INSERT INTO core.suppliers (company_id, code, name, email)
      VALUES ($1, $2, $3, $4)
      RETURNING id, company_id, code, name, email, status, created_at, updated_at
    `,
    [companyId, input.code, input.name, input.email],
  );
  return mapSupplier(result.rows[0]);
};

export const updateSupplierStatus = async (
  client: PoolClient,
  companyId: string,
  supplierId: string,
  status: CatalogStatus,
): Promise<Supplier | null> => {
  const result = await client.query<SupplierRow>(
    `
      UPDATE core.suppliers
      SET status = $1, updated_at = NOW()
      WHERE company_id = $2 AND id = $3
      RETURNING id, company_id, code, name, email, status, created_at, updated_at
    `,
    [status, companyId, supplierId],
  );
  return result.rows[0] ? mapSupplier(result.rows[0]) : null;
};

export const listMaterials = async (companyId: string): Promise<Material[]> => {
  const result = await db.query<MaterialRow>(
    `
      SELECT id, company_id, code, name, base_unit_code, status, created_at, updated_at
      FROM core.materials
      WHERE company_id = $1
      ORDER BY code
    `,
    [companyId],
  );
  return result.rows.map(mapMaterial);
};

export const createMaterial = async (
  client: PoolClient,
  companyId: string,
  input: { code: string; name: string; baseUnitCode: string },
): Promise<Material> => {
  const result = await client.query<MaterialRow>(
    `
      INSERT INTO core.materials (company_id, code, name, base_unit_code)
      VALUES ($1, $2, $3, $4)
      RETURNING id, company_id, code, name, base_unit_code, status, created_at, updated_at
    `,
    [companyId, input.code, input.name, input.baseUnitCode],
  );
  return mapMaterial(result.rows[0]);
};

export const updateMaterialStatus = async (
  client: PoolClient,
  companyId: string,
  materialId: string,
  status: CatalogStatus,
): Promise<Material | null> => {
  const result = await client.query<MaterialRow>(
    `
      UPDATE core.materials
      SET status = $1, updated_at = NOW()
      WHERE company_id = $2 AND id = $3
      RETURNING id, company_id, code, name, base_unit_code, status, created_at, updated_at
    `,
    [status, companyId, materialId],
  );
  return result.rows[0] ? mapMaterial(result.rows[0]) : null;
};

export const listCurrencies = async (): Promise<Currency[]> => {
  const result = await db.query<CurrencyRow>(
    `SELECT code, name, decimal_places, status FROM core.currencies ORDER BY code`,
  );
  return result.rows.map(mapCurrency);
};

export const createCurrency = async (
  client: PoolClient,
  input: { code: string; name: string; decimalPlaces: number },
): Promise<Currency> => {
  const result = await client.query<CurrencyRow>(
    `
      INSERT INTO core.currencies (code, name, decimal_places)
      VALUES ($1, $2, $3)
      RETURNING code, name, decimal_places, status
    `,
    [input.code, input.name, input.decimalPlaces],
  );
  return mapCurrency(result.rows[0]);
};

export const updateCurrencyStatus = async (
  client: PoolClient,
  code: string,
  status: CatalogStatus,
): Promise<Currency | null> => {
  const result = await client.query<CurrencyRow>(
    `
      UPDATE core.currencies
      SET status = $1
      WHERE code = $2
      RETURNING code, name, decimal_places, status
    `,
    [status, code],
  );
  return result.rows[0] ? mapCurrency(result.rows[0]) : null;
};

export const listUnits = async (): Promise<UnitOfMeasure[]> => {
  const result = await db.query<UnitRow>(
    `SELECT code, name, decimal_places, status FROM core.units_of_measure ORDER BY code`,
  );
  return result.rows.map(mapUnit);
};

export const createUnit = async (
  client: PoolClient,
  input: { code: string; name: string; decimalPlaces: number },
): Promise<UnitOfMeasure> => {
  const result = await client.query<UnitRow>(
    `
      INSERT INTO core.units_of_measure (code, name, decimal_places)
      VALUES ($1, $2, $3)
      RETURNING code, name, decimal_places, status
    `,
    [input.code, input.name, input.decimalPlaces],
  );
  return mapUnit(result.rows[0]);
};

export const updateUnitStatus = async (
  client: PoolClient,
  code: string,
  status: CatalogStatus,
): Promise<UnitOfMeasure | null> => {
  const result = await client.query<UnitRow>(
    `
      UPDATE core.units_of_measure
      SET status = $1
      WHERE code = $2
      RETURNING code, name, decimal_places, status
    `,
    [status, code],
  );
  return result.rows[0] ? mapUnit(result.rows[0]) : null;
};