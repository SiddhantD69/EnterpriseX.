import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseRequisition,
  RequisitionLine,
  RequisitionStatus,
  StockBalance,
  SupplierInvoice,
} from "../domain/procurement.js";

type RequisitionRow = {
  id: string;
  company_id: string;
  plant_id: string;
  document_number: string;
  status: RequisitionStatus;
  description: string | null;
  created_at: Date | string;
};

type RequisitionLineRow = {
  id: string;
  requisition_id: string;
  line_number: number;
  material_id: string;
  material_code: string;
  material_name: string;
  unit_code: string;
  quantity: string | number;
};

const mapRequisitionLine = (row: RequisitionLineRow): RequisitionLine => ({
  id: row.id,
  lineNumber: row.line_number,
  materialId: row.material_id,
  materialCode: row.material_code,
  materialName: row.material_name,
  unitCode: row.unit_code,
  quantity: Number(row.quantity),
});

const requisitionLineSelect = `
  SELECT rl.id, rl.requisition_id, rl.line_number, rl.material_id, m.code AS material_code,
         m.name AS material_name, rl.unit_code, rl.quantity
  FROM procurement.requisition_lines rl
  INNER JOIN core.materials m
    ON m.company_id = rl.company_id AND m.id = rl.material_id
`;

const mapRequisition = (
  row: RequisitionRow,
  lines: RequisitionLine[],
): PurchaseRequisition => ({
  id: row.id,
  companyId: row.company_id,
  plantId: row.plant_id,
  documentNumber: row.document_number,
  status: row.status,
  description: row.description,
  createdAt: new Date(row.created_at).toISOString(),
  lines,
});

export const listRequisitions = async (
  companyId: string,
): Promise<PurchaseRequisition[]> => {
  const headers = await db.query<RequisitionRow>(
    `
      SELECT id, company_id, plant_id, document_number, status, description, created_at
      FROM procurement.requisitions
      WHERE company_id = $1
      ORDER BY created_at DESC, document_number DESC
    `,
    [companyId],
  );

  if (headers.rowCount === 0) {
    return [];
  }

  const lines = await db.query<RequisitionLineRow>(
    `${requisitionLineSelect}
     WHERE rl.company_id = $1 AND rl.requisition_id = ANY($2::uuid[])
     ORDER BY rl.requisition_id, rl.line_number`,
    [companyId, headers.rows.map((row) => row.id)],
  );
  const byRequisition = new Map<string, RequisitionLine[]>();
  for (const row of lines.rows) {
    const rows = byRequisition.get(row.requisition_id) ?? [];
    rows.push(mapRequisitionLine(row));
    byRequisition.set(row.requisition_id, rows);
  }

  return headers.rows.map((row) =>
    mapRequisition(row, byRequisition.get(row.id) ?? []),
  );
};

export const getRequisition = async (
  companyId: string,
  requisitionId: string,
): Promise<PurchaseRequisition | null> => {
  const header = await db.query<RequisitionRow>(
    `
      SELECT id, company_id, plant_id, document_number, status, description, created_at
      FROM procurement.requisitions
      WHERE company_id = $1 AND id = $2
    `,
    [companyId, requisitionId],
  );
  if (!header.rows[0]) {
    return null;
  }
  const lines = await db.query<RequisitionLineRow>(
    `${requisitionLineSelect}
     WHERE rl.company_id = $1 AND rl.requisition_id = $2
     ORDER BY rl.line_number`,
    [companyId, requisitionId],
  );
  return mapRequisition(header.rows[0], lines.rows.map(mapRequisitionLine));
};

export const lockRequisition = async (
  client: PoolClient,
  companyId: string,
  requisitionId: string,
): Promise<RequisitionRow | null> => {
  const result = await client.query<RequisitionRow>(
    `
      SELECT id, company_id, plant_id, document_number, status, description, created_at
      FROM procurement.requisitions
      WHERE company_id = $1 AND id = $2
      FOR UPDATE
    `,
    [companyId, requisitionId],
  );
  return result.rows[0] ?? null;
};

export const getRequisitionLinesForUpdate = async (
  client: PoolClient,
  companyId: string,
  requisitionId: string,
): Promise<RequisitionLine[]> => {
  const result = await client.query<RequisitionLineRow>(
    `${requisitionLineSelect}
     WHERE rl.company_id = $1 AND rl.requisition_id = $2
     ORDER BY rl.line_number
     FOR UPDATE OF rl`,
    [companyId, requisitionId],
  );
  return result.rows.map(mapRequisitionLine);
};

export const insertRequisition = async (
  client: PoolClient,
  input: {
    companyId: string;
    plantId: string;
    number: string;
    requesterUserId: string;
    description: string | null;
  },
): Promise<RequisitionRow> => {
  const result = await client.query<RequisitionRow>(
    `
      INSERT INTO procurement.requisitions (
        company_id, plant_id, document_number, requester_user_id, description
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, company_id, plant_id, document_number, status, description, created_at
    `,
    [input.companyId, input.plantId, input.number, input.requesterUserId, input.description],
  );
  return result.rows[0];
};

export const insertRequisitionLine = async (
  client: PoolClient,
  input: {
    companyId: string;
    requisitionId: string;
    lineNumber: number;
    materialId: string;
    unitCode: string;
    quantity: number;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO procurement.requisition_lines (
        company_id, requisition_id, line_number, material_id, unit_code, quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [input.companyId, input.requisitionId, input.lineNumber, input.materialId, input.unitCode, input.quantity],
  );
  return result.rows[0].id;
};

export const replaceDraftRequisition = async (
  client: PoolClient,
  companyId: string,
  requisitionId: string,
  description: string | null,
): Promise<void> => {
  await client.query(
    `UPDATE procurement.requisitions
     SET description = $1, updated_at = NOW()
     WHERE company_id = $2 AND id = $3 AND status = 'DRAFT'`,
    [description, companyId, requisitionId],
  );
  await client.query(
    `DELETE FROM procurement.requisition_lines
     WHERE company_id = $1 AND requisition_id = $2`,
    [companyId, requisitionId],
  );
};

export const setRequisitionStatus = async (
  client: PoolClient,
  companyId: string,
  requisitionId: string,
  status: RequisitionStatus,
): Promise<void> => {
  await client.query(
    `UPDATE procurement.requisitions
     SET status = $1, updated_at = NOW()
     WHERE company_id = $2 AND id = $3`,
    [status, companyId, requisitionId],
  );
};

type PurchaseOrderRow = {
  id: string;
  company_id: string;
  plant_id: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  document_number: string;
  currency_code: string;
  status: PurchaseOrder["status"];
  created_at: Date | string;
};

type PurchaseOrderLineRow = {
  id: string;
  purchase_order_id?: string;
  line_number: number;
  source_requisition_line_id: string | null;
  material_id: string;
  material_code: string;
  material_name: string;
  unit_code: string;
  quantity: string | number;
  received_quantity: string | number;
  invoiced_quantity: string | number;
  unit_price: string | number;
};

const purchaseOrderLineSelect = `
  SELECT pol.id, pol.purchase_order_id, pol.line_number, pol.source_requisition_line_id,
         pol.material_id, m.code AS material_code, m.name AS material_name,
         pol.unit_code, pol.quantity, pol.received_quantity,
         pol.invoiced_quantity, pol.unit_price
  FROM procurement.purchase_order_lines pol
  INNER JOIN core.materials m
    ON m.company_id = pol.company_id AND m.id = pol.material_id
`;

const mapPurchaseOrderLine = (row: PurchaseOrderLineRow): PurchaseOrderLine => ({
  id: row.id,
  lineNumber: row.line_number,
  sourceRequisitionLineId: row.source_requisition_line_id,
  materialId: row.material_id,
  materialCode: row.material_code,
  materialName: row.material_name,
  unitCode: row.unit_code,
  quantity: Number(row.quantity),
  receivedQuantity: Number(row.received_quantity),
  invoicedQuantity: Number(row.invoiced_quantity),
  unitPrice: Number(row.unit_price),
});

const mapPurchaseOrder = (
  row: PurchaseOrderRow,
  lines: PurchaseOrderLine[],
): PurchaseOrder => ({
  id: row.id,
  companyId: row.company_id,
  plantId: row.plant_id,
  supplierId: row.supplier_id,
  supplierCode: row.supplier_code,
  supplierName: row.supplier_name,
  documentNumber: row.document_number,
  currencyCode: row.currency_code,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  lines,
});

const purchaseOrderHeaderSelect = `
  SELECT po.id, po.company_id, po.plant_id, po.supplier_id,
         s.code AS supplier_code, s.name AS supplier_name,
         po.document_number, po.currency_code, po.status, po.created_at
  FROM procurement.purchase_orders po
  INNER JOIN core.suppliers s
    ON s.company_id = po.company_id AND s.id = po.supplier_id
`;

export const listPurchaseOrders = async (
  companyId: string,
): Promise<PurchaseOrder[]> => {
  const headers = await db.query<PurchaseOrderRow>(
    `${purchaseOrderHeaderSelect}
     WHERE po.company_id = $1
     ORDER BY po.created_at DESC, po.document_number DESC`,
    [companyId],
  );
  if (headers.rowCount === 0) return [];

  const lines = await db.query<PurchaseOrderLineRow & { purchase_order_id: string }>(
    `${purchaseOrderLineSelect}
     WHERE pol.company_id = $1 AND pol.purchase_order_id = ANY($2::uuid[])
     ORDER BY pol.purchase_order_id, pol.line_number`,
    [companyId, headers.rows.map((row) => row.id)],
  );
  const grouped = new Map<string, PurchaseOrderLine[]>();
  for (const row of lines.rows) {
    const orderLines = grouped.get(row.purchase_order_id) ?? [];
    orderLines.push(mapPurchaseOrderLine(row));
    grouped.set(row.purchase_order_id, orderLines);
  }
  return headers.rows.map((row) =>
    mapPurchaseOrder(row, grouped.get(row.id) ?? []),
  );
};

export const insertPurchaseOrder = async (
  client: PoolClient,
  input: {
    companyId: string;
    plantId: string;
    supplierId: string;
    documentNumber: string;
    currencyCode: string;
    createdBy: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO procurement.purchase_orders (
        company_id, plant_id, supplier_id, document_number, currency_code, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [input.companyId, input.plantId, input.supplierId, input.documentNumber, input.currencyCode, input.createdBy],
  );
  return result.rows[0].id;
};

export const insertPurchaseOrderLine = async (
  client: PoolClient,
  input: {
    companyId: string;
    purchaseOrderId: string;
    sourceRequisitionLineId: string;
    lineNumber: number;
    materialId: string;
    unitCode: string;
    quantity: number;
    unitPrice: number;
  },
): Promise<void> => {
  await client.query(
    `
      INSERT INTO procurement.purchase_order_lines (
        company_id, purchase_order_id, source_requisition_line_id,
        line_number, material_id, unit_code, quantity, unit_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [input.companyId, input.purchaseOrderId, input.sourceRequisitionLineId,
      input.lineNumber, input.materialId, input.unitCode, input.quantity, input.unitPrice],
  );
};

export const getPurchaseOrderForUpdate = async (
  client: PoolClient,
  companyId: string,
  purchaseOrderId: string,
): Promise<PurchaseOrderRow | null> => {
  const result = await client.query<PurchaseOrderRow>(
    `${purchaseOrderHeaderSelect}
     WHERE po.company_id = $1 AND po.id = $2
     FOR UPDATE OF po`,
    [companyId, purchaseOrderId],
  );
  return result.rows[0] ?? null;
};

export const getPurchaseOrderLinesForUpdate = async (
  client: PoolClient,
  companyId: string,
  purchaseOrderId: string,
): Promise<Array<PurchaseOrderLine & { sourceRequisitionLineId: string | null }>> => {
  const result = await client.query<PurchaseOrderLineRow>(
    `${purchaseOrderLineSelect}
     WHERE pol.company_id = $1 AND pol.purchase_order_id = $2
     ORDER BY pol.line_number
     FOR UPDATE OF pol`,
    [companyId, purchaseOrderId],
  );
  return result.rows.map(mapPurchaseOrderLine);
};

export const updateOrderLineReceivedQuantity = async (
  client: PoolClient,
  companyId: string,
  lineId: string,
  quantity: number,
): Promise<void> => {
  await client.query(
    `UPDATE procurement.purchase_order_lines
     SET received_quantity = received_quantity + $1
     WHERE company_id = $2 AND id = $3`,
    [quantity, companyId, lineId],
  );
};

export const updateOrderLineInvoicedQuantity = async (
  client: PoolClient,
  companyId: string,
  lineId: string,
  quantity: number,
): Promise<void> => {
  await client.query(
    `UPDATE procurement.purchase_order_lines
     SET invoiced_quantity = invoiced_quantity + $1
     WHERE company_id = $2 AND id = $3`,
    [quantity, companyId, lineId],
  );
};

export const setPurchaseOrderStatus = async (
  client: PoolClient,
  companyId: string,
  purchaseOrderId: string,
  status: PurchaseOrder["status"],
): Promise<void> => {
  await client.query(
    `UPDATE procurement.purchase_orders
     SET status = $1, updated_at = NOW()
     WHERE company_id = $2 AND id = $3`,
    [status, companyId, purchaseOrderId],
  );
};

export const insertGoodsReceipt = async (
  client: PoolClient,
  input: {
    companyId: string;
    purchaseOrderId: string;
    documentNumber: string;
    receivedBy: string;
  },
): Promise<{ id: string; receivedAt: Date | string }> => {
  const result = await client.query<{ id: string; received_at: Date | string }>(
    `
      INSERT INTO inventory.goods_receipts (
        company_id, purchase_order_id, document_number, received_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, received_at
    `,
    [input.companyId, input.purchaseOrderId, input.documentNumber, input.receivedBy],
  );
  return { id: result.rows[0].id, receivedAt: result.rows[0].received_at };
};

export const insertGoodsReceiptLine = async (
  client: PoolClient,
  input: {
    companyId: string;
    receiptId: string;
    purchaseOrderLineId: string;
    storageLocationId: string;
    quantity: number;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO inventory.goods_receipt_lines (
        company_id, goods_receipt_id, purchase_order_line_id,
        storage_location_id, quantity
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [input.companyId, input.receiptId, input.purchaseOrderLineId,
      input.storageLocationId, input.quantity],
  );
  return result.rows[0].id;
};

export const upsertStockBalance = async (
  client: PoolClient,
  companyId: string,
  storageLocationId: string,
  materialId: string,
  quantity: number,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO inventory.stock_balances (
        company_id, storage_location_id, material_id, quantity
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (company_id, storage_location_id, material_id)
      DO UPDATE SET
        quantity = inventory.stock_balances.quantity + EXCLUDED.quantity,
        updated_at = NOW()
    `,
    [companyId, storageLocationId, materialId, quantity],
  );
};

export const insertStockMovement = async (
  client: PoolClient,
  input: {
    companyId: string;
    receiptLineId: string;
    storageLocationId: string;
    materialId: string;
    quantity: number;
  },
): Promise<void> => {
  await client.query(
    `
      INSERT INTO inventory.stock_movements (
        company_id, goods_receipt_line_id, storage_location_id,
        material_id, quantity_delta
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [input.companyId, input.receiptLineId, input.storageLocationId,
      input.materialId, input.quantity],
  );
};

export const insertSupplierInvoice = async (
  client: PoolClient,
  input: {
    companyId: string;
    purchaseOrderId: string;
    supplierId: string;
    supplierInvoiceNumber: string;
    createdBy: string;
  },
): Promise<{ id: string; createdAt: Date | string }> => {
  const result = await client.query<{ id: string; created_at: Date | string }>(
    `
      INSERT INTO procurement.supplier_invoices (
        company_id, purchase_order_id, supplier_id,
        supplier_invoice_number, created_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `,
    [input.companyId, input.purchaseOrderId, input.supplierId,
      input.supplierInvoiceNumber, input.createdBy],
  );
  return { id: result.rows[0].id, createdAt: result.rows[0].created_at };
};

export const insertSupplierInvoiceLine = async (
  client: PoolClient,
  input: {
    companyId: string;
    invoiceId: string;
    purchaseOrderLineId: string;
    quantity: number;
    unitPrice: number;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO procurement.supplier_invoice_lines (
        company_id, supplier_invoice_id, purchase_order_line_id,
        quantity, unit_price
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [input.companyId, input.invoiceId, input.purchaseOrderLineId,
      input.quantity, input.unitPrice],
  );
  return result.rows[0].id;
};

export const listSupplierInvoices = async (
  companyId: string,
): Promise<SupplierInvoice[]> => {
  const headers = await db.query<{
    id: string;
    company_id: string;
    purchase_order_id: string;
    supplier_id: string;
    supplier_invoice_number: string;
    status: SupplierInvoice["status"];
    created_at: Date | string;
  }>(
    `
      SELECT id, company_id, purchase_order_id, supplier_id,
             supplier_invoice_number, status, created_at
      FROM procurement.supplier_invoices
      WHERE company_id = $1
      ORDER BY created_at DESC, supplier_invoice_number DESC
    `,
    [companyId],
  );
  if (headers.rowCount === 0) return [];

  const lineRows = await db.query<{
    id: string;
    supplier_invoice_id: string;
    purchase_order_line_id: string;
    quantity: string | number;
    unit_price: string | number;
  }>(
    `
      SELECT id, supplier_invoice_id, purchase_order_line_id, quantity, unit_price
      FROM procurement.supplier_invoice_lines
      WHERE company_id = $1
        AND supplier_invoice_id = ANY($2::uuid[])
      ORDER BY supplier_invoice_id, id
    `,
    [companyId, headers.rows.map((row) => row.id)],
  );
  const linesByInvoice = new Map<SupplierInvoice["id"], SupplierInvoice["lines"]>();
  for (const row of lineRows.rows) {
    const lines = linesByInvoice.get(row.supplier_invoice_id) ?? [];
    lines.push({
      id: row.id,
      purchaseOrderLineId: row.purchase_order_line_id,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    });
    linesByInvoice.set(row.supplier_invoice_id, lines);
  }

  return headers.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    purchaseOrderId: row.purchase_order_id,
    supplierId: row.supplier_id,
    supplierInvoiceNumber: row.supplier_invoice_number,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    lines: linesByInvoice.get(row.id) ?? [],
  }));
};

export const getStockMovements = async (
  companyId: string,
): Promise<Array<{
  id: string;
  storageLocationId: string;
  materialId: string;
  quantityDelta: number;
  occurredAt: string;
  goodsReceiptLineId: string;
}>> => {
  const result = await db.query<{
    id: string;
    storage_location_id: string;
    material_id: string;
    quantity_delta: string | number;
    occurred_at: Date | string;
    goods_receipt_line_id: string;
  }>(
    `
      SELECT id, storage_location_id, material_id, quantity_delta,
             occurred_at, goods_receipt_line_id
      FROM inventory.stock_movements
      WHERE company_id = $1
      ORDER BY occurred_at DESC, id DESC
      LIMIT 500
    `,
    [companyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    storageLocationId: row.storage_location_id,
    materialId: row.material_id,
    quantityDelta: Number(row.quantity_delta),
    occurredAt: new Date(row.occurred_at).toISOString(),
    goodsReceiptLineId: row.goods_receipt_line_id,
  }));
};

export const getStockBalances = async (
  companyId: string,
): Promise<StockBalance[]> => {
  const result = await db.query<{
    storage_location_id: string;
    storage_location_code: string;
    warehouse_id: string;
    warehouse_code: string;
    plant_id: string;
    material_id: string;
    material_code: string;
    material_name: string;
    unit_code: string;
    quantity: string | number;
  }>(
    `
      SELECT sb.storage_location_id, sl.code AS storage_location_code,
             w.id AS warehouse_id, w.code AS warehouse_code,
             w.plant_id, sb.material_id, m.code AS material_code,
             m.name AS material_name, m.base_unit_code AS unit_code,
             sb.quantity
      FROM inventory.stock_balances sb
      INNER JOIN core.storage_locations sl
        ON sl.company_id = sb.company_id AND sl.id = sb.storage_location_id
      INNER JOIN core.warehouses w
        ON w.company_id = sl.company_id AND w.id = sl.warehouse_id
      INNER JOIN core.materials m
        ON m.company_id = sb.company_id AND m.id = sb.material_id
      WHERE sb.company_id = $1
      ORDER BY w.code, sl.code, m.code
    `,
    [companyId],
  );
  return result.rows.map((row) => ({
    storageLocationId: row.storage_location_id,
    storageLocationCode: row.storage_location_code,
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    plantId: row.plant_id,
    materialId: row.material_id,
    materialCode: row.material_code,
    materialName: row.material_name,
    unitCode: row.unit_code,
    quantity: Number(row.quantity),
  }));
};