import type { FastifyBaseLogger } from "fastify";

import { allocateDocumentNumber } from "../../../infrastructure/database/document-numbering.js";
import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  getBomById,
  getProductionOrderById,
  getStockBalance,
  insertBom,
  insertBomLine,
  insertProductionConfirmation,
  insertProductionIssue,
  insertProductionOrder,
  listCompanyBillsOfMaterial,
  listCompanyProductionOrders,
  updateProductionOrder,
  upsertStockBalance,
} from "../infrastructure/manufacturing-repository.js";

export class ManufacturingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManufacturingValidationError";
  }
}

export class ManufacturingNotFoundError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ManufacturingNotFoundError";
    this.code = code;
  }
}

export class ManufacturingConflictError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ManufacturingConflictError";
    this.code = code;
  }
}

export type BomLine = {
  id: string;
  bomId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  createdAt: string;
};

export type BillOfMaterial = {
  id: string;
  companyId: string;
  productMaterialId: string;
  productMaterialCode: string;
  productMaterialName: string;
  quantityPerBatch: number;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: BomLine[];
};

export type ProductionOrder = {
  id: string;
  companyId: string;
  bomId: string;
  plantId: string;
  productMaterialId: string;
  productMaterialCode: string;
  productMaterialName: string;
  documentNumber: string;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  plannedQuantity: number;
  producedQuantity: number;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeUuid = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ManufacturingValidationError(`${fieldName} must be a valid UUID.`);
  }
  return value;
};

const normalizeOptionalText = (value: unknown, fieldName: string, max: number): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ManufacturingValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > max) {
    throw new ManufacturingValidationError(`${fieldName} must not exceed ${max} characters.`);
  }
  return normalized;
};

const normalizePositiveNumber = (value: unknown, fieldName: string): number => {
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new ManufacturingValidationError(`${fieldName} must be numeric.`);
    }
    return parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new ManufacturingValidationError(`${fieldName} must be numeric.`);
};

export const validateCreateBomInput = (input: unknown): {
  productMaterialId: string;
  quantityPerBatch: number;
  description: string | null;
  lines: Array<{ materialId: string; quantity: number }>;
} => {
  if (!isRecord(input)) {
    throw new ManufacturingValidationError("BOM input must be a JSON object.");
  }

  const allowedFields = new Set(["productMaterialId", "quantityPerBatch", "description", "lines"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new ManufacturingValidationError("The request contains an unsupported field.");
  }

  const productMaterialId = normalizeUuid(input.productMaterialId, "Product material ID");
  const quantityPerBatch = normalizePositiveNumber(input.quantityPerBatch, "Quantity per batch");
  if (quantityPerBatch <= 0) {
    throw new ManufacturingValidationError("Quantity per batch must be greater than zero.");
  }
  const description = normalizeOptionalText(input.description, "Description", 500);

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new ManufacturingValidationError("At least one BOM line is required.");
  }

  const lines = input.lines.map((line, index) => {
    if (!isRecord(line)) {
      throw new ManufacturingValidationError(`BOM line ${index + 1} must be a JSON object.`);
    }
    const materialId = normalizeUuid(line.materialId, `BOM line ${index + 1} material ID`);
    const quantity = normalizePositiveNumber(line.quantity, `BOM line ${index + 1} quantity`);
    return { materialId, quantity };
  });

  if (new Set(lines.map((line) => line.materialId)).size !== lines.length) {
    throw new ManufacturingValidationError("A BOM cannot repeat the same material on more than one line.");
  }

  return { productMaterialId, quantityPerBatch, description, lines };
};

export const validateCreateProductionOrderInput = (input: unknown): {
  bomId: string;
  plantId: string;
  plannedQuantity: number;
  description: string | null;
} => {
  if (!isRecord(input)) {
    throw new ManufacturingValidationError("Production order input must be a JSON object.");
  }

  const allowedFields = new Set(["bomId", "plantId", "plannedQuantity", "description"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new ManufacturingValidationError("The request contains an unsupported field.");
  }

  return {
    bomId: normalizeUuid(input.bomId, "BOM ID"),
    plantId: normalizeUuid(input.plantId, "Plant ID"),
    plannedQuantity: normalizePositiveNumber(input.plannedQuantity, "Planned quantity"),
    description: normalizeOptionalText(input.description, "Description", 500),
  };
};

export const validateIssueMaterialsInput = (input: unknown): {
  storageLocationId: string;
  lines: Array<{ materialId: string; quantity: number }>;
} => {
  if (!isRecord(input)) {
    throw new ManufacturingValidationError("Issue input must be a JSON object.");
  }

  const allowedFields = new Set(["storageLocationId", "lines"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new ManufacturingValidationError("The request contains an unsupported field.");
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new ManufacturingValidationError("At least one material issue line is required.");
  }

  return {
    storageLocationId: normalizeUuid(input.storageLocationId, "Storage location ID"),
    lines: input.lines.map((line, index) => {
      if (!isRecord(line)) {
        throw new ManufacturingValidationError(`Issue line ${index + 1} must be a JSON object.`);
      }
      return {
        materialId: normalizeUuid(line.materialId, `Issue line ${index + 1} material ID`),
        quantity: normalizePositiveNumber(line.quantity, `Issue line ${index + 1} quantity`),
      };
    }),
  };
};

export const validateConfirmProductionInput = (input: unknown): {
  storageLocationId: string;
  producedQuantity: number;
} => {
  if (!isRecord(input)) {
    throw new ManufacturingValidationError("Confirmation input must be a JSON object.");
  }

  const allowedFields = new Set(["storageLocationId", "producedQuantity"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new ManufacturingValidationError("The request contains an unsupported field.");
  }

  const producedQuantity = normalizePositiveNumber(input.producedQuantity, "Produced quantity");
  return {
    storageLocationId: normalizeUuid(input.storageLocationId, "Storage location ID"),
    producedQuantity,
  };
};

export const listBoms = async (companyId: string): Promise<BillOfMaterial[]> => listCompanyBillsOfMaterial(companyId);

export const createBom = async (
  companyId: string,
  actorUserId: string,
  input: unknown,
  context: AuditContext,
): Promise<BillOfMaterial> => {
  const validated = validateCreateBomInput(input);

  return withDatabaseTransaction(async (client) => {
    const existing = await getBomById(client, companyId, validated.productMaterialId);
    if (existing) {
      throw new ManufacturingConflictError("BOM_EXISTS", "A BOM already exists for this finished-goods material.");
    }

    const bom = await insertBom(client, companyId, actorUserId, validated.productMaterialId, validated.quantityPerBatch, validated.description);
    for (const line of validated.lines) {
      await insertBomLine(client, companyId, bom.id, line.materialId, line.quantity);
    }

    const created = await getBomById(client, companyId, validated.productMaterialId);
    if (!created) {
      throw new ManufacturingNotFoundError("BOM_NOT_FOUND", "BOM could not be loaded after creation.");
    }

    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "BOM_CREATED",
        entityType: "MANUFACTURING_BOM",
        entityId: bom.id,
        status: "SUCCESS",
        sourceModule: "manufacturing",
        afterData: { productMaterialId: validated.productMaterialId, quantityPerBatch: validated.quantityPerBatch, lines: created.lines },
        metadata: { operation: "manufacturing.bom.create" },
      },
      client,
    );

    return created;
  }, context.logger);
};

export const listProductionOrders = async (companyId: string): Promise<ProductionOrder[]> => listCompanyProductionOrders(companyId);

export const createProductionOrder = async (
  companyId: string,
  actorUserId: string,
  input: unknown,
  context: AuditContext,
): Promise<ProductionOrder> => {
  const validated = validateCreateProductionOrderInput(input);

  return withDatabaseTransaction(async (client) => {
    const bom = await getBomById(client, companyId, undefined, validated.bomId);
    if (!bom) {
      throw new ManufacturingNotFoundError("BOM_NOT_FOUND", "BOM not found for the company.");
    }

    const documentNumber = await allocateDocumentNumber(client, companyId, "MANUFACTURING_ORDER", "MO-");
    const order = await insertProductionOrder(client, companyId, validated.bomId, validated.plantId, actorUserId, documentNumber, validated.plannedQuantity, validated.description);

    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "PRODUCTION_ORDER_CREATED",
        entityType: "MANUFACTURING_ORDER",
        entityId: order.id,
        status: "SUCCESS",
        sourceModule: "manufacturing",
        afterData: {
          documentNumber,
          bomId: validated.bomId,
          plantId: validated.plantId,
          status: "DRAFT",
          plannedQuantity: validated.plannedQuantity,
        },
        metadata: { operation: "manufacturing.order.create" },
      },
      client,
    );

    return order;
  }, context.logger);
};

export const issueMaterials = async (
  companyId: string,
  orderId: string,
  actorUserId: string,
  input: unknown,
  context: AuditContext,
): Promise<ProductionOrder> => {
  const validated = validateIssueMaterialsInput(input);

  return withDatabaseTransaction(async (client) => {
    const order = await getProductionOrderById(client, companyId, orderId);
    if (!order) {
      throw new ManufacturingNotFoundError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found.");
    }
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new ManufacturingConflictError("ORDER_NOT_ISSUABLE", "The production order is no longer open for material issue.");
    }

    for (const line of validated.lines) {
      const current = await getStockBalance(client, companyId, validated.storageLocationId, line.materialId);
      if (!current || current.quantity < line.quantity) {
        throw new ManufacturingConflictError("INSUFFICIENT_MATERIAL", `Insufficient inventory available for material ${line.materialId}.`);
      }
      await upsertStockBalance(client, companyId, validated.storageLocationId, line.materialId, -line.quantity);
      await insertProductionIssue(client, companyId, order.id, line.materialId, validated.storageLocationId, line.quantity, actorUserId);
    }

    const updated = await updateProductionOrder(client, companyId, order.id, "IN_PROGRESS", undefined, undefined);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "PRODUCTION_MATERIAL_ISSUED",
        entityType: "MANUFACTURING_ORDER",
        entityId: order.id,
        status: "SUCCESS",
        sourceModule: "manufacturing",
        beforeData: { status: order.status },
        afterData: { status: updated.status, issuedLines: validated.lines },
        metadata: { operation: "manufacturing.order.issue" },
      },
      client,
    );

    return updated;
  }, context.logger);
};

export const confirmProduction = async (
  companyId: string,
  orderId: string,
  actorUserId: string,
  input: unknown,
  context: AuditContext,
): Promise<ProductionOrder> => {
  const validated = validateConfirmProductionInput(input);

  return withDatabaseTransaction(async (client) => {
    const order = await getProductionOrderById(client, companyId, orderId);
    if (!order) {
      throw new ManufacturingNotFoundError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found.");
    }
    if (order.status === "COMPLETED") {
      throw new ManufacturingConflictError("ORDER_ALREADY_COMPLETED", "The production order has already been completed.");
    }
    if (validated.producedQuantity > order.plannedQuantity) {
      throw new ManufacturingValidationError("Produced quantity cannot exceed the planned quantity.");
    }

    await upsertStockBalance(client, companyId, validated.storageLocationId, order.productMaterialId, validated.producedQuantity);
    await insertProductionConfirmation(client, companyId, order.id, validated.storageLocationId, validated.producedQuantity, actorUserId);

    const updated = await updateProductionOrder(client, companyId, order.id, "COMPLETED", validated.producedQuantity, new Date().toISOString());
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "PRODUCTION_CONFIRMED",
        entityType: "MANUFACTURING_ORDER",
        entityId: order.id,
        status: "SUCCESS",
        sourceModule: "manufacturing",
        beforeData: { status: order.status, producedQuantity: order.producedQuantity },
        afterData: { status: updated.status, producedQuantity: updated.producedQuantity, storageLocationId: validated.storageLocationId },
        metadata: { operation: "manufacturing.order.confirm" },
      },
      client,
    );

    return updated;
  }, context.logger);
};
