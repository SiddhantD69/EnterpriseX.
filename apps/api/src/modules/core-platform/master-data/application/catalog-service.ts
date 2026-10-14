import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../audit/application/record-audit-event.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "./master-data-errors.js";
import type {
  CatalogStatus,
  Currency,
  Material,
  Supplier,
  UnitOfMeasure,
} from "../domain/catalog.js";
import {
  createCurrency,
  createMaterial,
  createSupplier,
  createUnit,
  listCurrencies,
  listMaterials,
  listSuppliers,
  listUnits,
  updateCurrencyStatus,
  updateMaterialStatus,
  updateSupplierStatus,
  updateUnitStatus,
} from "../infrastructure/catalog-repository.js";

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

const STATUSES: CatalogStatus[] = ["ACTIVE", "INACTIVE"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strictFields = (
  input: unknown,
  fields: string[],
): Record<string, unknown> => {
  if (!isRecord(input)) {
    throw new MasterDataValidationError("A JSON object is required.");
  }
  if (Object.keys(input).some((field) => !fields.includes(field))) {
    throw new MasterDataValidationError(
      "The request contains an unsupported field.",
    );
  }
  return input;
};

const requiredText = (
  value: unknown,
  field: string,
  maxLength: number,
): string => {
  if (typeof value !== "string") {
    throw new MasterDataValidationError(`${field} must be a string.`);
  }
  const result = value.trim();
  if (!result) {
    throw new MasterDataValidationError(`${field} is required.`);
  }
  if (result.length > maxLength) {
    throw new MasterDataValidationError(
      `${field} must not exceed ${maxLength} characters.`,
    );
  }
  return result;
};

const validateStatus = (value: unknown): CatalogStatus => {
  if (typeof value !== "string" || !STATUSES.includes(value as CatalogStatus)) {
    throw new MasterDataValidationError("Status must be ACTIVE or INACTIVE.");
  }
  return value as CatalogStatus;
};

const validateUuid = (value: string, name: string): void => {
  if (!UUID_PATTERN.test(value)) {
    throw new MasterDataValidationError(`${name} must be a valid identifier.`);
  }
};

const validateDecimals = (value: unknown, max: number): number => {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > max) {
    throw new MasterDataValidationError(
      `Decimal places must be an integer between 0 and ${max}.`,
    );
  }
  return value as number;
};

const audit = async (
  client: Parameters<Parameters<typeof withDatabaseTransaction>[0]>[0],
  context: AuditContext,
  companyId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  afterData: unknown,
): Promise<void> => {
  await recordAuditEvent(
    {
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      companyId,
      action,
      entityType,
      entityId,
      status: "SUCCESS",
      sourceModule: "core-platform",
      afterData,
      metadata: { operation: action.toLowerCase() },
    },
    client,
  );
};

export const getSuppliers = (companyId: string): Promise<Supplier[]> =>
  listSuppliers(companyId);

export const createCompanySupplier = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Supplier> => {
  const body = strictFields(input, ["code", "name", "email"]);
  const code = requiredText(body.code, "Supplier code", 50);
  const name = requiredText(body.name, "Supplier name", 255);
  let email: string | null = null;
  if (body.email !== undefined && body.email !== null && body.email !== "") {
    email = requiredText(body.email, "Supplier email", 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new MasterDataValidationError("Supplier email is invalid.");
    }
  }

  return withDatabaseTransaction(async (client) => {
    const supplier = await createSupplier(client, companyId, {
      code,
      name,
      email,
    });
    await audit(client, context, companyId, "SUPPLIER_CREATED", "SUPPLIER", supplier.id, {
      code: supplier.code,
      name: supplier.name,
      email: supplier.email,
      status: supplier.status,
    });
    return supplier;
  }, context.logger);
};

export const updateCompanySupplierStatus = async (
  companyId: string,
  supplierId: string,
  input: unknown,
  context: AuditContext,
): Promise<Supplier> => {
  validateUuid(supplierId, "Supplier ID");
  const status = validateStatus(strictFields(input, ["status"]).status);
  return withDatabaseTransaction(async (client) => {
    const supplier = await updateSupplierStatus(
      client,
      companyId,
      supplierId,
      status,
    );
    if (!supplier) {
      throw new MasterDataNotFoundError("SUPPLIER_NOT_FOUND", "Supplier not found.");
    }
    await audit(client, context, companyId, "SUPPLIER_STATUS_UPDATED", "SUPPLIER", supplier.id, {
      code: supplier.code,
      status: supplier.status,
    });
    return supplier;
  }, context.logger);
};

export const getMaterials = (companyId: string): Promise<Material[]> =>
  listMaterials(companyId);

export const createCompanyMaterial = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Material> => {
  const body = strictFields(input, ["code", "name", "baseUnitCode"]);
  const values = {
    code: requiredText(body.code, "Material code", 50),
    name: requiredText(body.name, "Material name", 255),
    baseUnitCode: requiredText(body.baseUnitCode, "Base unit", 20).toUpperCase(),
  };

  return withDatabaseTransaction(async (client) => {
    const unit = await client.query(
      "SELECT code FROM core.units_of_measure WHERE code = $1 AND status = 'ACTIVE'",
      [values.baseUnitCode],
    );
    if (unit.rowCount !== 1) {
      throw new MasterDataNotFoundError("UNIT_NOT_FOUND", "Active unit of measure not found.");
    }
    const material = await createMaterial(client, companyId, values);
    await audit(client, context, companyId, "MATERIAL_CREATED", "MATERIAL", material.id, {
      code: material.code,
      name: material.name,
      baseUnitCode: material.baseUnitCode,
      status: material.status,
    });
    return material;
  }, context.logger);
};

export const updateCompanyMaterialStatus = async (
  companyId: string,
  materialId: string,
  input: unknown,
  context: AuditContext,
): Promise<Material> => {
  validateUuid(materialId, "Material ID");
  const status = validateStatus(strictFields(input, ["status"]).status);
  return withDatabaseTransaction(async (client) => {
    const material = await updateMaterialStatus(client, companyId, materialId, status);
    if (!material) {
      throw new MasterDataNotFoundError("MATERIAL_NOT_FOUND", "Material not found.");
    }
    await audit(client, context, companyId, "MATERIAL_STATUS_UPDATED", "MATERIAL", material.id, {
      code: material.code,
      status: material.status,
    });
    return material;
  }, context.logger);
};

export const getCurrencies = (): Promise<Currency[]> => listCurrencies();

export const createCurrencyDefinition = async (
  input: unknown,
  companyId: string,
  context: AuditContext,
): Promise<Currency> => {
  const body = strictFields(input, ["code", "name", "decimalPlaces"]);
  const code = requiredText(body.code, "Currency code", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new MasterDataValidationError("Currency code must contain three letters.");
  }
  const values = {
    code,
    name: requiredText(body.name, "Currency name", 100),
    decimalPlaces: validateDecimals(body.decimalPlaces, 4),
  };
  return withDatabaseTransaction(async (client) => {
    const currency = await createCurrency(client, values);
    await audit(client, context, companyId, "CURRENCY_CREATED", "CURRENCY", null, currency);
    return currency;
  }, context.logger);
};

export const updateCurrencyDefinitionStatus = async (
  code: string,
  input: unknown,
  companyId: string,
  context: AuditContext,
): Promise<Currency> => {
  const normalizedCode = requiredText(code, "Currency code", 3).toUpperCase();
  const status = validateStatus(strictFields(input, ["status"]).status);
  return withDatabaseTransaction(async (client) => {
    const currency = await updateCurrencyStatus(client, normalizedCode, status);
    if (!currency) {
      throw new MasterDataNotFoundError("CURRENCY_NOT_FOUND", "Currency not found.");
    }
    await audit(client, context, companyId, "CURRENCY_STATUS_UPDATED", "CURRENCY", null, currency);
    return currency;
  }, context.logger);
};

export const getUnits = (): Promise<UnitOfMeasure[]> => listUnits();

export const createUnitDefinition = async (
  input: unknown,
  companyId: string,
  context: AuditContext,
): Promise<UnitOfMeasure> => {
  const body = strictFields(input, ["code", "name", "decimalPlaces"]);
  const values = {
    code: requiredText(body.code, "Unit code", 20).toUpperCase(),
    name: requiredText(body.name, "Unit name", 100),
    decimalPlaces: validateDecimals(body.decimalPlaces, 6),
  };
  if (!/^[A-Z0-9_-]+$/.test(values.code)) {
    throw new MasterDataValidationError("Unit code contains invalid characters.");
  }
  return withDatabaseTransaction(async (client) => {
    const unit = await createUnit(client, values);
    await audit(client, context, companyId, "UNIT_CREATED", "UNIT_OF_MEASURE", null, unit);
    return unit;
  }, context.logger);
};

export const updateUnitDefinitionStatus = async (
  code: string,
  input: unknown,
  companyId: string,
  context: AuditContext,
): Promise<UnitOfMeasure> => {
  const normalizedCode = requiredText(code, "Unit code", 20).toUpperCase();
  const status = validateStatus(strictFields(input, ["status"]).status);
  return withDatabaseTransaction(async (client) => {
    const unit = await updateUnitStatus(client, normalizedCode, status);
    if (!unit) {
      throw new MasterDataNotFoundError("UNIT_NOT_FOUND", "Unit of measure not found.");
    }
    await audit(client, context, companyId, "UNIT_STATUS_UPDATED", "UNIT_OF_MEASURE", null, unit);
    return unit;
  }, context.logger);
};