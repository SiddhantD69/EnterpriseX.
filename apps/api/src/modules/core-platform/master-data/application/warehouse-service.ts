import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../audit/application/record-audit-event.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "./master-data-errors.js";
import type {
  CreateWarehouseInput,
  MasterDataStatus,
  UpdateWarehouseInput,
  Warehouse,
  WarehouseType,
} from "../domain/warehouse.js";
import {
  createWarehouse,
  findPlantInCompany,
  findWarehouse,
  listWarehouses,
  updateWarehouse,
} from "../infrastructure/warehouse-repository.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WAREHOUSE_TYPES: WarehouseType[] = [
  "STANDARD",
  "RAW_MATERIAL",
  "FINISHED_GOODS",
  "SPARE_PARTS",
  "TRANSIT",
  "QUARANTINE",
];
const STATUSES: MasterDataStatus[] = ["ACTIVE", "INACTIVE"];

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);

const requiredText = (
  value: unknown,
  fieldName: string,
  maxLength: number,
): string => {
  if (typeof value !== "string") {
    throw new MasterDataValidationError(
      `${fieldName} must be a string.`,
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new MasterDataValidationError(
      `${fieldName} is required.`,
    );
  }

  if (normalized.length > maxLength) {
    throw new MasterDataValidationError(
      `${fieldName} must not exceed ${maxLength} characters.`,
    );
  }

  return normalized;
};

const requiredUuid = (
  value: unknown,
  fieldName: string,
): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new MasterDataValidationError(
      `${fieldName} must be a valid identifier.`,
    );
  }

  return value;
};

const validateWarehouseInput = (
  input: unknown,
  update: boolean,
): CreateWarehouseInput | UpdateWarehouseInput => {
  if (!isRecord(input)) {
    throw new MasterDataValidationError(
      "A JSON object is required.",
    );
  }

  const allowedFields = new Set([
    "plantId",
    "code",
    "name",
    "warehouseType",
    ...(update ? ["status"] : []),
  ]);

  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new MasterDataValidationError(
      "The request contains an unsupported field.",
    );
  }

  const warehouseType = input.warehouseType === undefined
    ? "STANDARD"
    : input.warehouseType;
  if (
    typeof warehouseType !== "string" ||
    !WAREHOUSE_TYPES.includes(warehouseType as WarehouseType)
  ) {
    throw new MasterDataValidationError(
      "Warehouse type is invalid.",
    );
  }

  const baseInput: CreateWarehouseInput = {
    plantId: requiredUuid(input.plantId, "Plant ID"),
    code: requiredText(input.code, "Warehouse code", 50),
    name: requiredText(input.name, "Warehouse name", 255),
    warehouseType: warehouseType as WarehouseType,
  };

  if (!update) {
    return baseInput;
  }

  if (
    typeof input.status !== "string" ||
    !STATUSES.includes(input.status as MasterDataStatus)
  ) {
    throw new MasterDataValidationError(
      "Warehouse status is invalid.",
    );
  }

  return {
    ...baseInput,
    status: input.status as MasterDataStatus,
  };
};

const validateWarehouseId = (warehouseId: string): void => {
  requiredUuid(warehouseId, "Warehouse ID");
};

export const getWarehouses = async (
  companyId: string,
): Promise<Warehouse[]> => listWarehouses(companyId);

export const getWarehouse = async (
  companyId: string,
  warehouseId: string,
): Promise<Warehouse> => {
  validateWarehouseId(warehouseId);
  const warehouse = await findWarehouse(companyId, warehouseId);

  if (!warehouse) {
    throw new MasterDataNotFoundError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found.",
    );
  }

  return warehouse;
};

export const createCompanyWarehouse = async (
  companyId: string,
  input: unknown,
  auditContext: {
    actorUserId: string;
    organizationId: string;
    logger?: Pick<FastifyBaseLogger, "error">;
  },
): Promise<Warehouse> => {
  const validatedInput = validateWarehouseInput(input, false) as CreateWarehouseInput;

  return withDatabaseTransaction(async (client) => {
    if (
      !(await findPlantInCompany(
        client,
        companyId,
        validatedInput.plantId,
      ))
    ) {
      throw new MasterDataNotFoundError(
        "PLANT_NOT_FOUND",
        "Plant not found for this company.",
      );
    }

    const warehouse = await createWarehouse(
      client,
      companyId,
      validatedInput,
    );

    await recordAuditEvent(
      {
        actorUserId: auditContext.actorUserId,
        organizationId: auditContext.organizationId,
        companyId,
        action: "WAREHOUSE_CREATED",
        entityType: "WAREHOUSE",
        entityId: warehouse.id,
        status: "SUCCESS",
        sourceModule: "core-platform",
        afterData: {
          plantId: warehouse.plantId,
          code: warehouse.code,
          name: warehouse.name,
          warehouseType: warehouse.warehouseType,
          status: warehouse.status,
        },
        metadata: { operation: "warehouse.create" },
      },
      client,
    );

    return warehouse;
  }, auditContext.logger);
};

export const updateCompanyWarehouse = async (
  companyId: string,
  warehouseId: string,
  input: unknown,
  auditContext: {
    actorUserId: string;
    organizationId: string;
    logger?: Pick<FastifyBaseLogger, "error">;
  },
): Promise<Warehouse> => {
  validateWarehouseId(warehouseId);
  const validatedInput = validateWarehouseInput(input, true) as UpdateWarehouseInput;

  return withDatabaseTransaction(async (client) => {
    if (
      !(await findPlantInCompany(
        client,
        companyId,
        validatedInput.plantId,
      ))
    ) {
      throw new MasterDataNotFoundError(
        "PLANT_NOT_FOUND",
        "Plant not found for this company.",
      );
    }

    const warehouse = await updateWarehouse(
      client,
      companyId,
      warehouseId,
      validatedInput,
    );

    if (!warehouse) {
      throw new MasterDataNotFoundError(
        "WAREHOUSE_NOT_FOUND",
        "Warehouse not found.",
      );
    }

    await recordAuditEvent(
      {
        actorUserId: auditContext.actorUserId,
        organizationId: auditContext.organizationId,
        companyId,
        action: "WAREHOUSE_UPDATED",
        entityType: "WAREHOUSE",
        entityId: warehouse.id,
        status: "SUCCESS",
        sourceModule: "core-platform",
        afterData: {
          plantId: warehouse.plantId,
          code: warehouse.code,
          name: warehouse.name,
          warehouseType: warehouse.warehouseType,
          status: warehouse.status,
        },
        metadata: { operation: "warehouse.update" },
      },
      client,
    );

    return warehouse;
  }, auditContext.logger);
};