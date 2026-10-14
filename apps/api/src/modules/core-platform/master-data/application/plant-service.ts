
import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../audit/application/record-audit-event.js";
import type {
  CreatePlantInput,
  Plant,
} from "../domain/plant.js";
import {
  createPlant,
  listPlants,
} from "../infrastructure/plant-repository.js";

export class PlantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlantValidationError";
  }
}

const optionalText = (
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new PlantValidationError(
      `${fieldName} must be a string.`,
    );
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw new PlantValidationError(
      `${fieldName} must not exceed ${maxLength} characters.`,
    );
  }

  return normalized;
};

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);

export const validateCreatePlantInput = (
  input: unknown,
): CreatePlantInput => {
  if (!isRecord(input)) {
    throw new PlantValidationError(
      "A JSON object is required.",
    );
  }

  const allowedFields = new Set([
    "code",
    "name",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "countryCode",
  ]);

  if (
    Object.keys(input).some(
      (field) => !allowedFields.has(field),
    )
  ) {
    throw new PlantValidationError(
      "The request contains an unsupported field.",
    );
  }

  if (
    input.code !== undefined &&
    typeof input.code !== "string"
  ) {
    throw new PlantValidationError(
      "Plant code must be a string.",
    );
  }

  if (
    input.name !== undefined &&
    typeof input.name !== "string"
  ) {
    throw new PlantValidationError(
      "Plant name must be a string.",
    );
  }

  const code = input.code?.trim();
  const name = input.name?.trim();

  if (!code) {
    throw new PlantValidationError("Plant code is required.");
  }

  if (code.length > 50) {
    throw new PlantValidationError(
      "Plant code must not exceed 50 characters.",
    );
  }

  if (!name) {
    throw new PlantValidationError("Plant name is required.");
  }

  if (name.length > 255) {
    throw new PlantValidationError(
      "Plant name must not exceed 255 characters.",
    );
  }

  const countryCode = optionalText(
    input.countryCode,
    "Country code",
    10,
  )?.toUpperCase();

  return {
    code,
    name,
    addressLine1: optionalText(
      input.addressLine1,
      "Address line 1",
      255,
    ),
    addressLine2: optionalText(
      input.addressLine2,
      "Address line 2",
      255,
    ),
    city: optionalText(input.city, "City", 100),
    state: optionalText(input.state, "State", 100),
    postalCode: optionalText(
      input.postalCode,
      "Postal code",
      20,
    ),
    countryCode,
  };
};

export const getPlants = async (
  companyId: string,
): Promise<Plant[]> => {
  return listPlants(companyId);
};

export const createCompanyPlant = async (
  companyId: string,
  input: unknown,
  auditContext: {
    actorUserId: string;
    organizationId: string;
    logger?: Pick<FastifyBaseLogger, "error">;
  },
): Promise<Plant> => {
  const validatedInput = validateCreatePlantInput(input);

  return withDatabaseTransaction(async (client) => {
    const plant = await createPlant(
      companyId,
      validatedInput,
      client,
    );

    await recordAuditEvent(
      {
        actorUserId: auditContext.actorUserId,
        organizationId: auditContext.organizationId,
        companyId,
        action: "PLANT_CREATED",
        entityType: "PLANT",
        entityId: plant.id,
        status: "SUCCESS",
        sourceModule: "core-platform",
        afterData: {
          code: plant.code,
          name: plant.name,
          status: plant.status,
        },
        metadata: {
          operation: "plant.create",
        },
      },
      client,
    );

    return plant;
  }, auditContext.logger);
};
