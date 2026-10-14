import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../audit/application/record-audit-event.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "./master-data-errors.js";
import type {
  CreateStorageLocationInput,
  StorageLocation,
  UpdateStorageLocationInput,
} from "../domain/storage-location.js";
import type { MasterDataStatus } from "../domain/warehouse.js";
import {
  createStorageLocation,
  findStorageLocation,
  findWarehouseInCompany,
  listStorageLocations,
  updateStorageLocation,
} from "../infrastructure/storage-location-repository.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

const validateStorageLocationInput = (
  input: unknown,
  update: boolean,
): CreateStorageLocationInput | UpdateStorageLocationInput => {
  if (!isRecord(input)) {
    throw new MasterDataValidationError(
      "A JSON object is required.",
    );
  }

  const allowedFields = new Set([
    "warehouseId",
    "code",
    "name",
    ...(update ? ["status"] : []),
  ]);

  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new MasterDataValidationError(
      "The request contains an unsupported field.",
    );
  }

  const baseInput: CreateStorageLocationInput = {
    warehouseId: requiredUuid(input.warehouseId, "Warehouse ID"),
    code: requiredText(input.code, "Storage location code", 50),
    name: requiredText(input.name, "Storage location name", 255),
  };

  if (!update) {
    return baseInput;
  }

  if (
    typeof input.status !== "string" ||
    !STATUSES.includes(input.status as MasterDataStatus)
  ) {
    throw new MasterDataValidationError(
      "Storage location status is invalid.",
    );
  }

  return {
    ...baseInput,
    status: input.status as MasterDataStatus,
  };
};

const validateStorageLocationId = (
  storageLocationId: string,
): void => {
  requiredUuid(storageLocationId, "Storage location ID");
};

export const getStorageLocations = async (
  companyId: string,
): Promise<StorageLocation[]> => listStorageLocations(companyId);

export const getStorageLocation = async (
  companyId: string,
  storageLocationId: string,
): Promise<StorageLocation> => {
  validateStorageLocationId(storageLocationId);
  const storageLocation = await findStorageLocation(
    companyId,
    storageLocationId,
  );

  if (!storageLocation) {
    throw new MasterDataNotFoundError(
      "STORAGE_LOCATION_NOT_FOUND",
      "Storage location not found.",
    );
  }

  return storageLocation;
};

export const createCompanyStorageLocation = async (
  companyId: string,
  input: unknown,
  auditContext: {
    actorUserId: string;
    organizationId: string;
    logger?: Pick<FastifyBaseLogger, "error">;
  },
): Promise<StorageLocation> => {
  const validatedInput = validateStorageLocationInput(input, false) as CreateStorageLocationInput;

  return withDatabaseTransaction(async (client) => {
    if (
      !(await findWarehouseInCompany(
        client,
        companyId,
        validatedInput.warehouseId,
      ))
    ) {
      throw new MasterDataNotFoundError(
        "WAREHOUSE_NOT_FOUND",
        "Warehouse not found for this company.",
      );
    }

    const storageLocation = await createStorageLocation(
      client,
      companyId,
      validatedInput,
    );

    await recordAuditEvent(
      {
        actorUserId: auditContext.actorUserId,
        organizationId: auditContext.organizationId,
        companyId,
        action: "STORAGE_LOCATION_CREATED",
        entityType: "STORAGE_LOCATION",
        entityId: storageLocation.id,
        status: "SUCCESS",
        sourceModule: "core-platform",
        afterData: {
          warehouseId: storageLocation.warehouseId,
          code: storageLocation.code,
          name: storageLocation.name,
          status: storageLocation.status,
        },
        metadata: { operation: "storage-location.create" },
      },
      client,
    );

    return storageLocation;
  }, auditContext.logger);
};

export const updateCompanyStorageLocation = async (
  companyId: string,
  storageLocationId: string,
  input: unknown,
  auditContext: {
    actorUserId: string;
    organizationId: string;
    logger?: Pick<FastifyBaseLogger, "error">;
  },
): Promise<StorageLocation> => {
  validateStorageLocationId(storageLocationId);
  const validatedInput = validateStorageLocationInput(input, true) as UpdateStorageLocationInput;

  return withDatabaseTransaction(async (client) => {
    if (
      !(await findWarehouseInCompany(
        client,
        companyId,
        validatedInput.warehouseId,
      ))
    ) {
      throw new MasterDataNotFoundError(
        "WAREHOUSE_NOT_FOUND",
        "Warehouse not found for this company.",
      );
    }

    const storageLocation = await updateStorageLocation(
      client,
      companyId,
      storageLocationId,
      validatedInput,
    );

    if (!storageLocation) {
      throw new MasterDataNotFoundError(
        "STORAGE_LOCATION_NOT_FOUND",
        "Storage location not found.",
      );
    }

    await recordAuditEvent(
      {
        actorUserId: auditContext.actorUserId,
        organizationId: auditContext.organizationId,
        companyId,
        action: "STORAGE_LOCATION_UPDATED",
        entityType: "STORAGE_LOCATION",
        entityId: storageLocation.id,
        status: "SUCCESS",
        sourceModule: "core-platform",
        afterData: {
          warehouseId: storageLocation.warehouseId,
          code: storageLocation.code,
          name: storageLocation.name,
          status: storageLocation.status,
        },
        metadata: { operation: "storage-location.update" },
      },
      client,
    );

    return storageLocation;
  }, auditContext.logger);
};