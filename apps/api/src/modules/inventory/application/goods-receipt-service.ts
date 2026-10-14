import type { FastifyBaseLogger } from "fastify";

import { allocateDocumentNumber } from "../../../infrastructure/database/document-numbering.js";
import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../../core-platform/master-data/application/master-data-errors.js";
import { ProcurementConflictError } from "../../procurement/application/procurement-service.js";
import type { GoodsReceipt } from "../../procurement/domain/procurement.js";
import {
  getPurchaseOrderForUpdate,
  getPurchaseOrderLinesForUpdate,
  insertGoodsReceipt,
  insertGoodsReceiptLine,
  insertStockMovement,
  setPurchaseOrderStatus,
  updateOrderLineReceivedQuantity,
  upsertStockBalance,
} from "../../procurement/infrastructure/procurement-repository.js";

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const uuid = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new MasterDataValidationError(`${field} must be a valid identifier.`);
  }
  return value;
};

const quantity = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001
  ) {
    throw new MasterDataValidationError(
      "Receipt quantity must be positive with no more than four decimal places.",
    );
  }
  return value;
};

export const createGoodsReceipt = async (
  companyId: string,
  purchaseOrderId: string,
  receivedBy: string,
  input: unknown,
  context: AuditContext,
): Promise<GoodsReceipt> => {
  uuid(purchaseOrderId, "Purchase order ID");
  if (!isRecord(input) || Object.keys(input).some((key) => key !== "lines")) {
    throw new MasterDataValidationError("Invalid goods receipt request.");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) {
    throw new MasterDataValidationError("At least one and no more than 100 receipt lines are required.");
  }
  const lines = input.lines.map((line, index) => {
    if (!isRecord(line) || Object.keys(line).some((key) => !["purchaseOrderLineId", "storageLocationId", "quantity"].includes(key))) {
      throw new MasterDataValidationError(`Receipt line ${index + 1} is invalid.`);
    }
    return {
      purchaseOrderLineId: uuid(line.purchaseOrderLineId, `Receipt line ${index + 1} order line ID`),
      storageLocationId: uuid(line.storageLocationId, `Receipt line ${index + 1} storage location ID`),
      quantity: quantity(line.quantity),
    };
  });
  if (new Set(lines.map((line) => line.purchaseOrderLineId)).size !== lines.length) {
    throw new MasterDataValidationError("A purchase-order line can appear only once per receipt.");
  }

  return withDatabaseTransaction(async (client) => {
    const order = await getPurchaseOrderForUpdate(client, companyId, purchaseOrderId);
    if (!order) {
      throw new MasterDataNotFoundError("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found.");
    }
    if (order.status === "RECEIVED" || order.status === "CANCELLED") {
      throw new ProcurementConflictError("PURCHASE_ORDER_NOT_RECEIVABLE", "Purchase order cannot receive additional goods.");
    }
    const orderLines = await getPurchaseOrderLinesForUpdate(client, companyId, purchaseOrderId);
    const orderLinesById = new Map(orderLines.map((line) => [line.id, line]));
    for (const line of lines) {
      const orderLine = orderLinesById.get(line.purchaseOrderLineId);
      if (!orderLine) {
        throw new MasterDataNotFoundError("PURCHASE_ORDER_LINE_NOT_FOUND", "Purchase-order line not found.");
      }
      if (line.quantity > orderLine.quantity - orderLine.receivedQuantity) {
        throw new ProcurementConflictError("RECEIPT_EXCEEDS_ORDER", "Receipt quantity exceeds the outstanding order quantity.");
      }
      const location = await client.query<{
        id: string;
        plant_id: string;
        status: string;
        warehouse_status: string;
      }>(
        `
          SELECT sl.id, w.plant_id, sl.status, w.status AS warehouse_status
          FROM core.storage_locations sl
          INNER JOIN core.warehouses w
            ON w.company_id = sl.company_id AND w.id = sl.warehouse_id
          WHERE sl.company_id = $1
            AND sl.id = $2
          FOR KEY SHARE OF sl, w
        `,
        [companyId, line.storageLocationId],
      );
      const destination = location.rows[0];
      if (!destination || destination.status !== "ACTIVE" || destination.warehouse_status !== "ACTIVE") {
        throw new MasterDataNotFoundError("STORAGE_LOCATION_NOT_FOUND", "Active storage location not found for this company.");
      }
      if (destination.plant_id !== order.plant_id) {
        throw new MasterDataValidationError("Receipt storage location must belong to the purchase-order plant.");
      }
    }

    const number = await allocateDocumentNumber(client, companyId, "GOODS_RECEIPT", "GR-");
    const receiptHeader = await insertGoodsReceipt(client, {
      companyId,
      purchaseOrderId,
      documentNumber: number,
      receivedBy,
    });
    const receiptLines: GoodsReceipt["lines"] = [];

    for (const line of lines) {
      const orderLine = orderLinesById.get(line.purchaseOrderLineId) as (typeof orderLines)[number];
      const receiptLineId = await insertGoodsReceiptLine(client, {
        companyId,
        receiptId: receiptHeader.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        storageLocationId: line.storageLocationId,
        quantity: line.quantity,
      });
      await updateOrderLineReceivedQuantity(
        client,
        companyId,
        line.purchaseOrderLineId,
        line.quantity,
      );
      await upsertStockBalance(
        client,
        companyId,
        line.storageLocationId,
        orderLine.materialId,
        line.quantity,
      );
      await insertStockMovement(client, {
        companyId,
        receiptLineId,
        storageLocationId: line.storageLocationId,
        materialId: orderLine.materialId,
        quantity: line.quantity,
      });
      receiptLines.push({
        id: receiptLineId,
        purchaseOrderLineId: line.purchaseOrderLineId,
        storageLocationId: line.storageLocationId,
        materialId: orderLine.materialId,
        quantity: line.quantity,
      });
    }

    const fullyReceived = orderLines.every((line) => {
      const receivedNow = lines.find((receiptLine) => receiptLine.purchaseOrderLineId === line.id)?.quantity ?? 0;
      return line.receivedQuantity + receivedNow >= line.quantity;
    });
    await setPurchaseOrderStatus(
      client,
      companyId,
      purchaseOrderId,
      fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
    );

    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "GOODS_RECEIPT_CREATED",
        entityType: "GOODS_RECEIPT",
        entityId: receiptHeader.id,
        status: "SUCCESS",
        sourceModule: "inventory",
        afterData: {
          documentNumber: number,
          purchaseOrderId,
          status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
          lines: receiptLines,
        },
        metadata: { operation: "goods-receipt.create" },
      },
      client,
    );

    return {
      id: receiptHeader.id,
      companyId,
      purchaseOrderId,
      documentNumber: number,
      receivedAt: new Date(receiptHeader.receivedAt).toISOString(),
      lines: receiptLines,
    };
  }, context.logger);
};