import type { FastifyBaseLogger } from "fastify";

import { allocateDocumentNumber } from "../../../infrastructure/database/document-numbering.js";
import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  getCustomerByCode,
  getOrderById,
  insertCustomer,
  insertSalesOrder,
  insertSalesOrderLine,
  listCompanyCustomers,
  listCompanyOrders,
  updateSalesOrderTotal,
} from "../infrastructure/sales-repository.js";

export class SalesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesValidationError";
  }
}

export class SalesNotFoundError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SalesNotFoundError";
    this.code = code;
  }
}

export class SalesConflictError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SalesConflictError";
    this.code = code;
  }
}

export type SalesCustomer = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  customerType: "B2B" | "B2C" | "INDIVIDUAL" | "GOVERNMENT";
  email: string | null;
  phone: string | null;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type SalesOrderLine = {
  id: string;
  orderId: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: string;
};

export type SalesOrder = {
  id: string;
  companyId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  documentNumber: string;
  description: string | null;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  totalAmount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: SalesOrderLine[];
};

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeCode = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new SalesValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new SalesValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 30) {
    throw new SalesValidationError(`${fieldName} must not exceed 30 characters.`);
  }
  return normalized;
};

const normalizeName = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new SalesValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new SalesValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 255) {
    throw new SalesValidationError(`${fieldName} must not exceed 255 characters.`);
  }
  return normalized;
};

const normalizeOptionalText = (value: unknown, fieldName: string, max: number): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new SalesValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > max) {
    throw new SalesValidationError(`${fieldName} must not exceed ${max} characters.`);
  }
  return normalized;
};

const normalizeAmount = (value: unknown, fieldName: string): number => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SalesValidationError(`${fieldName} must be numeric.`);
    }
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new SalesValidationError(`${fieldName} must be numeric.`);
    }
    return parsed;
  }
  throw new SalesValidationError(`${fieldName} must be numeric.`);
};

export const validateCreateCustomerInput = (input: unknown): {
  code: string;
  name: string;
  customerType: SalesCustomer["customerType"];
  email: string | null;
  phone: string | null;
  description: string | null;
} => {
  if (!isRecord(input)) {
    throw new SalesValidationError("Customer input must be a JSON object.");
  }

  const allowedFields = new Set(["code", "name", "customerType", "email", "phone", "description"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new SalesValidationError("The request contains an unsupported field.");
  }

  const code = normalizeCode(input.code, "Customer code");
  const name = normalizeName(input.name, "Customer name");
  const customerType = input.customerType;
  if (customerType !== "B2B" && customerType !== "B2C" && customerType !== "INDIVIDUAL" && customerType !== "GOVERNMENT") {
    throw new SalesValidationError("Customer type must be B2B, B2C, INDIVIDUAL, or GOVERNMENT.");
  }

  return {
    code,
    name,
    customerType,
    email: normalizeOptionalText(input.email, "Email", 320),
    phone: normalizeOptionalText(input.phone, "Phone", 50),
    description: normalizeOptionalText(input.description, "Description", 500),
  };
};

export const validateCreateOrderInput = (input: unknown): {
  customerCode: string;
  description: string | null;
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
} => {
  if (!isRecord(input)) {
    throw new SalesValidationError("Order input must be a JSON object.");
  }

  const allowedFields = new Set(["customerCode", "description", "lines"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new SalesValidationError("The request contains an unsupported field.");
  }

  const customerCode = normalizeCode(input.customerCode, "Customer code");
  const description = normalizeOptionalText(input.description, "Description", 500);

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new SalesValidationError("At least one sales order line is required.");
  }

  const lines = input.lines.map((line, index) => {
    if (!isRecord(line)) {
      throw new SalesValidationError(`Order line ${index + 1} must be a JSON object.`);
    }
    const allowedLineFields = new Set(["description", "quantity", "unitPrice"]);
    if (Object.keys(line).some((field) => !allowedLineFields.has(field))) {
      throw new SalesValidationError(`Order line ${index + 1} contains an unsupported field.`);
    }

    const descriptionText = normalizeName(line.description, `Order line ${index + 1} description`);
    const quantity = normalizeAmount(line.quantity, `Order line ${index + 1} quantity`);
    const unitPrice = normalizeAmount(line.unitPrice, `Order line ${index + 1} unit price`);

    if (quantity <= 0) {
      throw new SalesValidationError(`Order line ${index + 1} quantity must be greater than zero.`);
    }
    if (unitPrice < 0) {
      throw new SalesValidationError(`Order line ${index + 1} unit price cannot be negative.`);
    }

    return { description: descriptionText, quantity, unitPrice };
  });

  return { customerCode, description, lines };
};

export const listCustomers = async (companyId: string): Promise<SalesCustomer[]> => listCompanyCustomers(companyId);

export const createCustomer = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<SalesCustomer> => {
  const validated = validateCreateCustomerInput(input);

  return withDatabaseTransaction(async (client) => {
    const existing = await getCustomerByCode(client, companyId, validated.code);
    if (existing) {
      throw new SalesConflictError("CUSTOMER_CODE_EXISTS", "A customer with this code already exists for the company.");
    }

    const customer = await insertCustomer(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "CUSTOMER_CREATED",
        entityType: "SALES_CUSTOMER",
        entityId: customer.id,
        status: "SUCCESS",
        sourceModule: "sales",
        afterData: {
          code: customer.code,
          name: customer.name,
          customerType: customer.customerType,
        },
        metadata: { operation: "sales.customer.create" },
      },
      client,
    );

    return customer;
  }, context.logger);
};

export const listOrders = async (companyId: string): Promise<SalesOrder[]> => listCompanyOrders(companyId);

export const createOrder = async (
  companyId: string,
  actorUserId: string,
  input: unknown,
  context: AuditContext,
): Promise<SalesOrder> => {
  const validated = validateCreateOrderInput(input);

  return withDatabaseTransaction(async (client) => {
    const customer = await getCustomerByCode(client, companyId, validated.customerCode);
    if (!customer) {
      throw new SalesNotFoundError("CUSTOMER_NOT_FOUND", `Customer ${validated.customerCode} was not found in this company.`);
    }

    const documentNumber = await allocateDocumentNumber(client, companyId, "SALES_ORDER", "SO-");
    const order = await insertSalesOrder(client, companyId, customer.id, actorUserId, validated.description, documentNumber);

    let runningTotal = 0;
    for (const [index, line] of validated.lines.entries()) {
      const amount = line.quantity * line.unitPrice;
      runningTotal += amount;
      await insertSalesOrderLine(client, companyId, order.id, index + 1, line.description, line.quantity, line.unitPrice, amount);
    }

    await updateSalesOrderTotal(client, companyId, order.id, runningTotal);
    const finalizedOrder = await getOrderById(client, companyId, order.id);
    if (!finalizedOrder) {
      throw new SalesNotFoundError("ORDER_NOT_FOUND", "Order could not be loaded after creation.");
    }

    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "SALES_ORDER_CREATED",
        entityType: "SALES_ORDER",
        entityId: order.id,
        status: "SUCCESS",
        sourceModule: "sales",
        afterData: {
          documentNumber,
          customerCode: customer.code,
          totalAmount: runningTotal,
          status: "DRAFT",
        },
        metadata: { operation: "sales.order.create" },
      },
      client,
    );

    return finalizedOrder;
  }, context.logger);
};
