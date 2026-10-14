import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type { SalesCustomer, SalesOrder, SalesOrderLine } from "../application/sales-service.js";

export type SalesCustomerRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  customer_type: SalesCustomer["customerType"];
  email: string | null;
  phone: string | null;
  description: string | null;
  status: SalesCustomer["status"];
  created_at: Date | string;
  updated_at: Date | string;
};

const mapCustomer = (row: SalesCustomerRow): SalesCustomer => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  name: row.name,
  customerType: row.customer_type,
  email: row.email,
  phone: row.phone,
  description: row.description,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const listCompanyCustomers = async (companyId: string): Promise<SalesCustomer[]> => {
  const result = await db.query<SalesCustomerRow>(
    `
      SELECT id, company_id, code, name, customer_type, email, phone,
             description, status, created_at, updated_at
      FROM sales.customers
      WHERE company_id = $1
      ORDER BY code
    `,
    [companyId],
  );

  return result.rows.map(mapCustomer);
};

export const getCustomerByCode = async (
  client: PoolClient,
  companyId: string,
  code: string,
): Promise<SalesCustomer | null> => {
  const result = await client.query<SalesCustomerRow>(
    `
      SELECT id, company_id, code, name, customer_type, email, phone,
             description, status, created_at, updated_at
      FROM sales.customers
      WHERE company_id = $1 AND code = $2
      LIMIT 1
    `,
    [companyId, code],
  );

  return result.rows[0] ? mapCustomer(result.rows[0]) : null;
};

export const insertCustomer = async (
  client: PoolClient,
  companyId: string,
  input: {
    code: string;
    name: string;
    customerType: SalesCustomer["customerType"];
    email?: string | null;
    phone?: string | null;
    description?: string | null;
  },
): Promise<SalesCustomer> => {
  const result = await client.query<SalesCustomerRow>(
    `
      INSERT INTO sales.customers (
        company_id,
        code,
        name,
        customer_type,
        email,
        phone,
        description,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
      RETURNING id, company_id, code, name, customer_type, email, phone,
                description, status, created_at, updated_at
    `,
    [companyId, input.code, input.name, input.customerType, input.email ?? null, input.phone ?? null, input.description ?? null],
  );

  return mapCustomer(result.rows[0]);
};

export type SalesOrderRow = {
  id: string;
  company_id: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  created_by: string;
  document_number: string;
  description: string | null;
  status: SalesOrder["status"];
  total_amount: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type SalesOrderLineRow = {
  id: string;
  order_id: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  created_at: Date | string;
};

const mapOrderLine = (row: SalesOrderLineRow): SalesOrderLine => ({
  id: row.id,
  orderId: row.order_id,
  lineNumber: row.line_number,
  description: row.description,
  quantity: Number(row.quantity),
  unitPrice: Number(row.unit_price),
  amount: Number(row.amount),
  createdAt: new Date(row.created_at).toISOString(),
});

export const listCompanyOrders = async (companyId: string): Promise<SalesOrder[]> => {
  const headerRows = await db.query<SalesOrderRow>(
    `
      SELECT so.id, so.company_id, so.customer_id, c.code AS customer_code,
             c.name AS customer_name, so.created_by, so.document_number,
             so.description, so.status, so.total_amount, so.created_at, so.updated_at
      FROM sales.sales_orders so
      JOIN sales.customers c ON c.company_id = so.company_id AND c.id = so.customer_id
      WHERE so.company_id = $1
      ORDER BY so.created_at DESC, so.document_number DESC
    `,
    [companyId],
  );

  const orderIds = headerRows.rows.map((row) => row.id);
  const lineRows = orderIds.length > 0
    ? await db.query<SalesOrderLineRow>(
        `
          SELECT id, order_id, line_number, description, quantity, unit_price, amount, created_at
          FROM sales.sales_order_lines
          WHERE company_id = $1 AND order_id = ANY($2::uuid[])
          ORDER BY order_id, line_number
        `,
        [companyId, orderIds],
      )
    : { rows: [] as SalesOrderLineRow[] };

  const linesByOrder = new Map<string, SalesOrderLine[]>();
  for (const line of lineRows.rows) {
    const list = linesByOrder.get(line.order_id) ?? [];
    list.push(mapOrderLine(line));
    linesByOrder.set(line.order_id, list);
  }

  return headerRows.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    documentNumber: row.document_number,
    description: row.description,
    status: row.status,
    totalAmount: Number(row.total_amount),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lines: linesByOrder.get(row.id) ?? [],
  }));
};

export const getOrderById = async (
  client: PoolClient,
  companyId: string,
  orderId: string,
): Promise<SalesOrder | null> => {
  const headerRow = await client.query<SalesOrderRow>(
    `
      SELECT so.id, so.company_id, so.customer_id, c.code AS customer_code,
             c.name AS customer_name, so.created_by, so.document_number,
             so.description, so.status, so.total_amount, so.created_at, so.updated_at
      FROM sales.sales_orders so
      JOIN sales.customers c ON c.company_id = so.company_id AND c.id = so.customer_id
      WHERE so.company_id = $1 AND so.id = $2
      LIMIT 1
    `,
    [companyId, orderId],
  );

  if (!headerRow.rows[0]) {
    return null;
  }

  const orderIdRow = headerRow.rows[0];
  const lineRows = await client.query<SalesOrderLineRow>(
    `
      SELECT id, order_id, line_number, description, quantity, unit_price, amount, created_at
      FROM sales.sales_order_lines
      WHERE company_id = $1 AND order_id = $2
      ORDER BY line_number
    `,
    [companyId, orderId],
  );

  return {
    id: orderIdRow.id,
    companyId: orderIdRow.company_id,
    customerId: orderIdRow.customer_id,
    customerCode: orderIdRow.customer_code,
    customerName: orderIdRow.customer_name,
    documentNumber: orderIdRow.document_number,
    description: orderIdRow.description,
    status: orderIdRow.status,
    totalAmount: Number(orderIdRow.total_amount),
    createdBy: orderIdRow.created_by,
    createdAt: new Date(orderIdRow.created_at).toISOString(),
    updatedAt: new Date(orderIdRow.updated_at).toISOString(),
    lines: lineRows.rows.map(mapOrderLine),
  };
};

export const updateSalesOrderTotal = async (
  client: PoolClient,
  companyId: string,
  orderId: string,
  totalAmount: number,
): Promise<void> => {
  await client.query(
    `
      UPDATE sales.sales_orders
      SET total_amount = $3,
          updated_at = NOW()
      WHERE company_id = $1 AND id = $2
    `,
    [companyId, orderId, totalAmount],
  );
};

export const insertSalesOrder = async (
  client: PoolClient,
  companyId: string,
  customerId: string,
  actorUserId: string,
  description: string | null,
  documentNumber: string,
): Promise<{ id: string; documentNumber: string; totalAmount: number; status: "DRAFT" | "CONFIRMED" | "CANCELLED" }> => {
  const result = await client.query<{
    id: string;
    document_number: string;
    total_amount: string;
    status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  }>(
    `
      INSERT INTO sales.sales_orders (
        company_id,
        customer_id,
        created_by,
        document_number,
        description,
        status,
        total_amount
      )
      VALUES ($1, $2, $3, $4, $5, 'DRAFT', 0)
      RETURNING id, document_number, total_amount, status
    `,
    [companyId, customerId, actorUserId, documentNumber, description ?? null],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    documentNumber: row.document_number,
    totalAmount: Number(row.total_amount),
    status: row.status,
  };
};

export const insertSalesOrderLine = async (
  client: PoolClient,
  companyId: string,
  orderId: string,
  lineNumber: number,
  description: string,
  quantity: number,
  unitPrice: number,
  amount: number,
): Promise<SalesOrderLine> => {
  const result = await client.query<SalesOrderLineRow>(
    `
      INSERT INTO sales.sales_order_lines (
        company_id,
        order_id,
        line_number,
        description,
        quantity,
        unit_price,
        amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, order_id, line_number, description, quantity, unit_price, amount, created_at
    `,
    [companyId, orderId, lineNumber, description, quantity.toString(), unitPrice.toString(), amount.toString()],
  );

  return mapOrderLine(result.rows[0]);
};
