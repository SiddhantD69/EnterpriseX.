import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";

import { allocateDocumentNumber } from "../../../infrastructure/database/document-numbering.js";
import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../../core-platform/master-data/application/master-data-errors.js";
import type {
  PurchaseOrder,
  PurchaseRequisition,
  RequisitionLine,
} from "../domain/procurement.js";
import {
  getPurchaseOrderLinesForUpdate,
  getRequisition,
  getRequisitionLinesForUpdate,
  insertPurchaseOrder,
  insertPurchaseOrderLine,
  insertRequisition,
  insertRequisitionLine,
  listPurchaseOrders,
  listRequisitions,
  lockRequisition,
  replaceDraftRequisition,
  setRequisitionStatus,
} from "../infrastructure/procurement-repository.js";

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

export class ProcurementConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProcurementConflictError";
    this.code = code;
  }
}

type RequisitionLineInput = {
  materialId: string;
  unitCode: string;
  quantity: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateUuid = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new MasterDataValidationError(`${name} must be a valid identifier.`);
  }
  return value;
};

const validateText = (
  value: unknown,
  name: string,
  maxLength: number,
): string => {
  if (typeof value !== "string") {
    throw new MasterDataValidationError(`${name} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new MasterDataValidationError(`${name} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new MasterDataValidationError(
      `${name} must not exceed ${maxLength} characters.`,
    );
  }
  return normalized;
};

const validateQuantity = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001
  ) {
    throw new MasterDataValidationError(
      "Quantity must be positive with no more than four decimal places.",
    );
  }
  return value;
};

const validatePrice = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001
  ) {
    throw new MasterDataValidationError(
      "Unit price must be non-negative with no more than four decimal places.",
    );
  }
  return value;
};

const validateRequisitionInput = (
  input: unknown,
): { plantId: string; description: string | null; lines: RequisitionLineInput[] } => {
  if (!isRecord(input)) {
    throw new MasterDataValidationError("A JSON object is required.");
  }
  if (Object.keys(input).some((key) => !["plantId", "description", "lines"].includes(key))) {
    throw new MasterDataValidationError("The request contains an unsupported field.");
  }
  const plantId = validateUuid(input.plantId, "Plant ID");
  let description: string | null = null;
  if (input.description !== undefined && input.description !== null && input.description !== "") {
    description = validateText(input.description, "Description", 500);
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) {
    throw new MasterDataValidationError("At least one and no more than 100 lines are required.");
  }
  const lines = input.lines.map((line, index): RequisitionLineInput => {
    if (!isRecord(line) || Object.keys(line).some((key) => !["materialId", "unitCode", "quantity"].includes(key))) {
      throw new MasterDataValidationError(`Line ${index + 1} is invalid.`);
    }
    return {
      materialId: validateUuid(line.materialId, `Line ${index + 1} material ID`),
      unitCode: validateText(line.unitCode, `Line ${index + 1} unit`, 20).toUpperCase(),
      quantity: validateQuantity(line.quantity),
    };
  });
  return { plantId, description, lines };
};

const auditEvent = async (
  client: PoolClient,
  context: AuditContext,
  companyId: string,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    afterData: unknown;
    operation: string;
  },
): Promise<void> => {
  await recordAuditEvent(
    {
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      companyId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      status: "SUCCESS",
      sourceModule: "procurement",
      afterData: input.afterData,
      metadata: { operation: input.operation },
    },
    client,
  );
};

const validateCompanyPlant = async (
  client: PoolClient,
  companyId: string,
  plantId: string,
): Promise<void> => {
  const result = await client.query(
    `SELECT id FROM core.plants WHERE company_id = $1 AND id = $2 AND status = 'ACTIVE'`,
    [companyId, plantId],
  );
  if (result.rowCount !== 1) {
    throw new MasterDataNotFoundError("PLANT_NOT_FOUND", "Active plant not found for this company.");
  }
};

const validateCompanyMaterials = async (
  client: PoolClient,
  companyId: string,
  lines: RequisitionLineInput[],
): Promise<Map<string, { baseUnitCode: string; code: string; name: string }>> => {
  const materialIds = [...new Set(lines.map((line) => line.materialId))];
  const unitCodes = [...new Set(lines.map((line) => line.unitCode))];
  const [materials, units] = await Promise.all([
    client.query<{ id: string; base_unit_code: string; code: string; name: string }>(
      `SELECT id, base_unit_code, code, name FROM core.materials
       WHERE company_id = $1 AND id = ANY($2::uuid[]) AND status = 'ACTIVE'`,
      [companyId, materialIds],
    ),
    client.query<{ code: string }>(
      `SELECT code FROM core.units_of_measure
       WHERE code = ANY($1::varchar[]) AND status = 'ACTIVE'`,
      [unitCodes],
    ),
  ]);
  const materialMap = new Map(materials.rows.map((row) => [row.id, {
    baseUnitCode: row.base_unit_code,
    code: row.code,
    name: row.name,
  }]));
  const activeUnits = new Set(units.rows.map((row) => row.code));
  for (const line of lines) {
    const material = materialMap.get(line.materialId);
    if (!material) {
      throw new MasterDataNotFoundError("MATERIAL_NOT_FOUND", "Active material not found for this company.");
    }
    if (!activeUnits.has(line.unitCode)) {
      throw new MasterDataNotFoundError("UNIT_NOT_FOUND", "Active unit of measure not found.");
    }
    if (line.unitCode !== material.baseUnitCode) {
      throw new MasterDataValidationError("This initial workflow only accepts the material base unit.");
    }
  }
  return materialMap;
};

const mapRequisitionResult = (
  header: {
    id: string;
    company_id: string;
    plant_id: string;
    document_number: string;
    status: PurchaseRequisition["status"];
    description: string | null;
    created_at: Date | string;
  },
  lines: RequisitionLine[],
): PurchaseRequisition => ({
  id: header.id,
  companyId: header.company_id,
  plantId: header.plant_id,
  documentNumber: header.document_number,
  status: header.status,
  description: header.description,
  createdAt: new Date(header.created_at).toISOString(),
  lines,
});

export const getCompanyRequisitions = (
  companyId: string,
): Promise<PurchaseRequisition[]> => listRequisitions(companyId);

export const getCompanyRequisition = async (
  companyId: string,
  requisitionId: string,
): Promise<PurchaseRequisition> => {
  validateUuid(requisitionId, "Requisition ID");
  const requisition = await getRequisition(companyId, requisitionId);
  if (!requisition) {
    throw new MasterDataNotFoundError("REQUISITION_NOT_FOUND", "Requisition not found.");
  }
  return requisition;
};

export const createRequisition = async (
  companyId: string,
  requesterUserId: string,
  input: unknown,
  context: AuditContext,
): Promise<PurchaseRequisition> => {
  const validated = validateRequisitionInput(input);
  return withDatabaseTransaction(async (client) => {
    await validateCompanyPlant(client, companyId, validated.plantId);
    const materialMap = await validateCompanyMaterials(client, companyId, validated.lines);
    const number = await allocateDocumentNumber(client, companyId, "PURCHASE_REQUISITION", "PR-");
    const header = await insertRequisition(client, {
      companyId,
      plantId: validated.plantId,
      number,
      requesterUserId,
      description: validated.description,
    });
    const lines: RequisitionLine[] = [];
    for (const [index, line] of validated.lines.entries()) {
      const id = await insertRequisitionLine(client, {
        companyId,
        requisitionId: header.id,
        lineNumber: index + 1,
        materialId: line.materialId,
        unitCode: line.unitCode,
        quantity: line.quantity,
      });
      lines.push({
        id,
        lineNumber: index + 1,
        materialId: line.materialId,
        materialCode: materialMap.get(line.materialId)!.code,
        materialName: materialMap.get(line.materialId)!.name,
        unitCode: line.unitCode,
        quantity: line.quantity,
      });
    }
    await auditEvent(client, context, companyId, {
      action: "PURCHASE_REQUISITION_CREATED",
      entityType: "PURCHASE_REQUISITION",
      entityId: header.id,
      afterData: { documentNumber: number, status: "DRAFT", lines },
      operation: "purchase-requisition.create",
    });
    return mapRequisitionResult(header, lines);
  }, context.logger);
};

export const updateDraftRequisition = async (
  companyId: string,
  requisitionId: string,
  input: unknown,
  context: AuditContext,
): Promise<PurchaseRequisition> => {
  validateUuid(requisitionId, "Requisition ID");
  const validated = validateRequisitionInput(input);
  return withDatabaseTransaction(async (client) => {
    const header = await lockRequisition(client, companyId, requisitionId);
    if (!header) {
      throw new MasterDataNotFoundError("REQUISITION_NOT_FOUND", "Requisition not found.");
    }
    if (header.status !== "DRAFT") {
      throw new ProcurementConflictError("REQUISITION_NOT_DRAFT", "Only draft requisitions can be edited.");
    }
    await validateCompanyPlant(client, companyId, validated.plantId);
    const materialMap = await validateCompanyMaterials(client, companyId, validated.lines);
    if (validated.plantId !== header.plant_id) {
      await client.query(
        `UPDATE procurement.requisitions SET plant_id = $1 WHERE company_id = $2 AND id = $3`,
        [validated.plantId, companyId, requisitionId],
      );
    }
    await replaceDraftRequisition(client, companyId, requisitionId, validated.description);
    const lines: RequisitionLine[] = [];
    for (const [index, line] of validated.lines.entries()) {
      const id = await insertRequisitionLine(client, {
        companyId,
        requisitionId,
        lineNumber: index + 1,
        materialId: line.materialId,
        unitCode: line.unitCode,
        quantity: line.quantity,
      });
      lines.push({
        id,
        lineNumber: index + 1,
        materialId: line.materialId,
        materialCode: materialMap.get(line.materialId)!.code,
        materialName: materialMap.get(line.materialId)!.name,
        unitCode: line.unitCode,
        quantity: line.quantity,
      });
    }
    const updatedHeader = { ...header, plant_id: validated.plantId, description: validated.description };
    await auditEvent(client, context, companyId, {
      action: "PURCHASE_REQUISITION_UPDATED",
      entityType: "PURCHASE_REQUISITION",
      entityId: requisitionId,
      afterData: { documentNumber: header.document_number, status: "DRAFT", lines },
      operation: "purchase-requisition.update",
    });
    return mapRequisitionResult(updatedHeader, lines);
  }, context.logger);
};

export const submitRequisition = async (
  companyId: string,
  requisitionId: string,
  context: AuditContext,
): Promise<{ id: string; documentNumber: string; status: "SUBMITTED" }> => {
  validateUuid(requisitionId, "Requisition ID");
  return withDatabaseTransaction(async (client) => {
    const header = await lockRequisition(client, companyId, requisitionId);
    if (!header) {
      throw new MasterDataNotFoundError("REQUISITION_NOT_FOUND", "Requisition not found.");
    }
    if (header.status !== "DRAFT") {
      throw new ProcurementConflictError("INVALID_REQUISITION_TRANSITION", "Only draft requisitions can be submitted.");
    }
    const lines = await getRequisitionLinesForUpdate(client, companyId, requisitionId);
    if (lines.length === 0) {
      throw new MasterDataValidationError("A requisition must have at least one line before submission.");
    }
    await setRequisitionStatus(client, companyId, requisitionId, "SUBMITTED");
    await auditEvent(client, context, companyId, {
      action: "PURCHASE_REQUISITION_SUBMITTED",
      entityType: "PURCHASE_REQUISITION",
      entityId: requisitionId,
      afterData: { documentNumber: header.document_number, status: "SUBMITTED" },
      operation: "purchase-requisition.submit",
    });
    return { id: requisitionId, documentNumber: header.document_number, status: "SUBMITTED" };
  }, context.logger);
};

export const getCompanyPurchaseOrders = (
  companyId: string,
): Promise<PurchaseOrder[]> => listPurchaseOrders(companyId);

export const createPurchaseOrderFromRequisition = async (
  companyId: string,
  requisitionId: string,
  createdBy: string,
  input: unknown,
  context: AuditContext,
): Promise<{ id: string; documentNumber: string; status: "OPEN" }> => {
  validateUuid(requisitionId, "Requisition ID");
  if (!isRecord(input) || Object.keys(input).some((key) => !["supplierId", "currencyCode", "unitPrices"].includes(key))) {
    throw new MasterDataValidationError("Invalid purchase-order request.");
  }
  const supplierId = validateUuid(input.supplierId, "Supplier ID");
  const currencyCode = validateText(input.currencyCode, "Currency code", 3).toUpperCase();
  if (!Array.isArray(input.unitPrices) || input.unitPrices.length > 100) {
    throw new MasterDataValidationError("Unit prices must be an array with no more than 100 entries.");
  }
  const prices = input.unitPrices.map((price, index) => {
    if (!isRecord(price) || Object.keys(price).some((key) => !["requisitionLineId", "unitPrice"].includes(key))) {
      throw new MasterDataValidationError(`Unit price ${index + 1} is invalid.`);
    }
    return {
      requisitionLineId: validateUuid(price.requisitionLineId, `Unit price ${index + 1} requisition line ID`),
      unitPrice: validatePrice(price.unitPrice),
    };
  });

  return withDatabaseTransaction(async (client) => {
    const requisition = await lockRequisition(client, companyId, requisitionId);
    if (!requisition) {
      throw new MasterDataNotFoundError("REQUISITION_NOT_FOUND", "Requisition not found.");
    }
    if (requisition.status !== "SUBMITTED") {
      throw new ProcurementConflictError("REQUISITION_NOT_ELIGIBLE", "Only submitted requisitions can be ordered.");
    }
    const supplier = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM core.suppliers WHERE company_id = $1 AND id = $2 FOR UPDATE`,
      [companyId, supplierId],
    );
    if (!supplier.rows[0] || supplier.rows[0].status !== "ACTIVE") {
      throw new MasterDataNotFoundError("SUPPLIER_NOT_FOUND", "Active supplier not found for this company.");
    }
    const currency = await client.query<{ code: string }>(
      `SELECT code FROM core.currencies WHERE code = $1 AND status = 'ACTIVE'`,
      [currencyCode],
    );
    if (currency.rowCount !== 1) {
      throw new MasterDataNotFoundError("CURRENCY_NOT_FOUND", "Active currency not found.");
    }
    const requisitionLines = await getRequisitionLinesForUpdate(client, companyId, requisitionId);
    if (requisitionLines.length === 0 || prices.length !== requisitionLines.length) {
      throw new MasterDataValidationError("Provide exactly one unit price for every requisition line.");
    }
    const priceByLine = new Map(prices.map((price) => [price.requisitionLineId, price.unitPrice]));
    if (priceByLine.size !== prices.length || requisitionLines.some((line) => !priceByLine.has(line.id))) {
      throw new MasterDataValidationError("Unit prices must match the requisition lines exactly.");
    }
    const number = await allocateDocumentNumber(client, companyId, "PURCHASE_ORDER", "PO-");
    const orderId = await insertPurchaseOrder(client, {
      companyId,
      plantId: requisition.plant_id,
      supplierId,
      documentNumber: number,
      currencyCode,
      createdBy,
    });
    for (const line of requisitionLines) {
      await insertPurchaseOrderLine(client, {
        companyId,
        purchaseOrderId: orderId,
        sourceRequisitionLineId: line.id,
        lineNumber: line.lineNumber,
        materialId: line.materialId,
        unitCode: line.unitCode,
        quantity: line.quantity,
        unitPrice: priceByLine.get(line.id) as number,
      });
    }
    await setRequisitionStatus(client, companyId, requisitionId, "ORDERED");
    await auditEvent(client, context, companyId, {
      action: "PURCHASE_ORDER_CREATED",
      entityType: "PURCHASE_ORDER",
      entityId: orderId,
      afterData: { documentNumber: number, requisitionId, supplierId, currencyCode, status: "OPEN" },
      operation: "purchase-order.create",
    });
    return { id: orderId, documentNumber: number, status: "OPEN" };
  }, context.logger);
};