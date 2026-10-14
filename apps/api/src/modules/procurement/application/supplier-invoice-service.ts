import type { FastifyBaseLogger } from "fastify";

import { allocateDocumentNumber } from "../../../infrastructure/database/document-numbering.js";
import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../../core-platform/master-data/application/master-data-errors.js";
import { ProcurementConflictError } from "./procurement-service.js";
import type { SupplierInvoice } from "../domain/procurement.js";
import {
  getPurchaseOrderForUpdate,
  getPurchaseOrderLinesForUpdate,
  insertSupplierInvoice,
  insertSupplierInvoiceLine,
  listSupplierInvoices,
  updateOrderLineInvoicedQuantity,
} from "../infrastructure/procurement-repository.js";

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
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

const validateQuantity = (value: unknown): number => {
  if (
    typeof value !== "number" || !Number.isFinite(value) || value <= 0 ||
    Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001
  ) {
    throw new MasterDataValidationError(
      "Invoice quantity must be positive with no more than four decimal places.",
    );
  }
  return value;
};

const validatePrice = (value: unknown): number => {
  if (
    typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
    Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001
  ) {
    throw new MasterDataValidationError(
      "Invoice unit price must be non-negative with no more than four decimal places.",
    );
  }
  return value;
};

export const createMatchedSupplierInvoice = async (
  companyId: string,
  purchaseOrderId: string,
  createdBy: string,
  input: unknown,
  context: AuditContext,
): Promise<SupplierInvoice> => {
  validateUuid(purchaseOrderId, "Purchase order ID");
  if (
    !isRecord(input) ||
    Object.keys(input).some((key) => !["supplierInvoiceNumber", "lines"].includes(key))
  ) {
    throw new MasterDataValidationError("Invalid supplier invoice request.");
  }
  if (typeof input.supplierInvoiceNumber !== "string") {
    throw new MasterDataValidationError("Supplier invoice number must be a string.");
  }
  const supplierInvoiceNumber = input.supplierInvoiceNumber.trim();
  if (!supplierInvoiceNumber || supplierInvoiceNumber.length > 100) {
    throw new MasterDataValidationError("Supplier invoice number is required and limited to 100 characters.");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) {
    throw new MasterDataValidationError("At least one and no more than 100 invoice lines are required.");
  }
  const lines = input.lines.map((line, index) => {
    if (
      !isRecord(line) ||
      Object.keys(line).some((key) => !["purchaseOrderLineId", "quantity", "unitPrice"].includes(key))
    ) {
      throw new MasterDataValidationError(`Invoice line ${index + 1} is invalid.`);
    }
    return {
      purchaseOrderLineId: validateUuid(line.purchaseOrderLineId, `Invoice line ${index + 1} order line ID`),
      quantity: validateQuantity(line.quantity),
      unitPrice: validatePrice(line.unitPrice),
    };
  });
  if (new Set(lines.map((line) => line.purchaseOrderLineId)).size !== lines.length) {
    throw new MasterDataValidationError("A purchase-order line can appear only once per invoice.");
  }

  return withDatabaseTransaction(async (client) => {
    const order = await getPurchaseOrderForUpdate(client, companyId, purchaseOrderId);
    if (!order) {
      throw new MasterDataNotFoundError("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found.");
    }
    if (order.status === "CANCELLED") {
      throw new ProcurementConflictError("PURCHASE_ORDER_CANCELLED", "Cancelled purchase orders cannot be invoiced.");
    }
    const orderLines = await getPurchaseOrderLinesForUpdate(client, companyId, purchaseOrderId);
    const byId = new Map(orderLines.map((line) => [line.id, line]));
    for (const line of lines) {
      const orderLine = byId.get(line.purchaseOrderLineId);
      if (!orderLine) {
        throw new MasterDataNotFoundError("PURCHASE_ORDER_LINE_NOT_FOUND", "Purchase-order line not found.");
      }
      if (line.quantity > orderLine.receivedQuantity - orderLine.invoicedQuantity) {
        throw new ProcurementConflictError("INVOICE_EXCEEDS_RECEIPTS", "Invoice quantity exceeds received, uninvoiced quantity.");
      }
      if (Math.round(line.unitPrice * 10000) !== Math.round(orderLine.unitPrice * 10000)) {
        throw new ProcurementConflictError("INVOICE_PRICE_MISMATCH", "Invoice unit price does not match the purchase order.");
      }
    }

    const invoice = await insertSupplierInvoice(client, {
      companyId,
      purchaseOrderId,
      supplierId: order.supplier_id,
      supplierInvoiceNumber,
      createdBy,
    });
    const createdLines: SupplierInvoice["lines"] = [];
    for (const line of lines) {
      const id = await insertSupplierInvoiceLine(client, {
        companyId,
        invoiceId: invoice.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      });
      await updateOrderLineInvoicedQuantity(
        client,
        companyId,
        line.purchaseOrderLineId,
        line.quantity,
      );
      createdLines.push({
        id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      });
    }

    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "SUPPLIER_INVOICE_MATCHED",
        entityType: "SUPPLIER_INVOICE",
        entityId: invoice.id,
        status: "SUCCESS",
        sourceModule: "procurement",
        afterData: {
          purchaseOrderId,
          supplierId: order.supplier_id,
          supplierInvoiceNumber,
          status: "MATCHED",
          lines: createdLines,
        },
        metadata: { operation: "supplier-invoice.match" },
      },
      client,
    );

    return {
      id: invoice.id,
      companyId,
      purchaseOrderId,
      supplierId: order.supplier_id,
      supplierInvoiceNumber,
      status: "MATCHED",
      createdAt: new Date(invoice.createdAt).toISOString(),
      lines: createdLines,
    };
  }, context.logger);
};

export const getCompanySupplierInvoices = (
  companyId: string,
): Promise<SupplierInvoice[]> => listSupplierInvoices(companyId);