import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type { BillOfMaterial, BomLine, ProductionOrder } from "../application/manufacturing-service.js";

export type BomRow = {
  id: string;
  company_id: string;
  product_material_id: string;
  product_material_code: string;
  product_material_name: string;
  quantity_per_batch: string;
  description: string | null;
  status: BillOfMaterial["status"];
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type BomLineRow = {
  id: string;
  bom_id: string;
  material_id: string;
  material_code: string;
  material_name: string;
  quantity: string;
  created_at: Date | string;
};

export type ProductionOrderRow = {
  id: string;
  company_id: string;
  bom_id: string;
  plant_id: string;
  product_material_id: string;
  product_material_code: string;
  product_material_name: string;
  document_number: string;
  status: ProductionOrder["status"];
  planned_quantity: string;
  produced_quantity: string;
  description: string | null;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
};

const mapBomLine = (row: BomLineRow): BomLine => ({
  id: row.id,
  bomId: row.bom_id,
  materialId: row.material_id,
  materialCode: row.material_code,
  materialName: row.material_name,
  quantity: Number(row.quantity),
  createdAt: new Date(row.created_at).toISOString(),
});

export const listCompanyBillsOfMaterial = async (companyId: string): Promise<BillOfMaterial[]> => {
  const rows = await db.query<BomRow>(
    `
      SELECT b.id, b.company_id, b.product_material_id, m.code AS product_material_code,
             m.name AS product_material_name, b.quantity_per_batch, b.description,
             b.status, b.created_by, b.created_at, b.updated_at
      FROM manufacturing.boms b
      JOIN core.materials m ON m.company_id = b.company_id AND m.id = b.product_material_id
      WHERE b.company_id = $1
      ORDER BY m.code
    `,
    [companyId],
  );

  const bomIds = rows.rows.map((row) => row.id);
  const lineRows = bomIds.length > 0
    ? await db.query<BomLineRow>(
        `
          SELECT bl.id, bl.bom_id, bl.material_id, m.code AS material_code,
                 m.name AS material_name, bl.quantity, bl.created_at
          FROM manufacturing.bom_lines bl
          JOIN core.materials m ON m.company_id = bl.company_id AND m.id = bl.material_id
          WHERE bl.company_id = $1 AND bl.bom_id = ANY($2::uuid[])
          ORDER BY bl.bom_id, bl.material_id
        `,
        [companyId, bomIds],
      )
    : { rows: [] as BomLineRow[] };

  const grouped = new Map<string, BomLine[]>();
  for (const line of lineRows.rows) {
    const list = grouped.get(line.bom_id) ?? [];
    list.push(mapBomLine(line));
    grouped.set(line.bom_id, list);
  }

  return rows.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    productMaterialId: row.product_material_id,
    productMaterialCode: row.product_material_code,
    productMaterialName: row.product_material_name,
    quantityPerBatch: Number(row.quantity_per_batch),
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lines: grouped.get(row.id) ?? [],
  }));
};

export const getBomById = async (
  client: PoolClient,
  companyId: string,
  productMaterialId?: string,
  bomId?: string,
): Promise<BillOfMaterial | null> => {
  const query = productMaterialId
    ? `
        SELECT b.id, b.company_id, b.product_material_id, m.code AS product_material_code,
               m.name AS product_material_name, b.quantity_per_batch, b.description,
               b.status, b.created_by, b.created_at, b.updated_at
        FROM manufacturing.boms b
        JOIN core.materials m ON m.company_id = b.company_id AND m.id = b.product_material_id
        WHERE b.company_id = $1 AND b.product_material_id = $2
        LIMIT 1
      `
    : `
        SELECT b.id, b.company_id, b.product_material_id, m.code AS product_material_code,
               m.name AS product_material_name, b.quantity_per_batch, b.description,
               b.status, b.created_by, b.created_at, b.updated_at
        FROM manufacturing.boms b
        JOIN core.materials m ON m.company_id = b.company_id AND m.id = b.product_material_id
        WHERE b.company_id = $1 AND b.id = $2
        LIMIT 1
      `;

  const params = productMaterialId ? [companyId, productMaterialId] : [companyId, bomId];
  const row = await client.query<BomRow>(query, params);
  if (!row.rows[0]) {
    return null;
  }

  const lines = await client.query<BomLineRow>(
    `
      SELECT bl.id, bl.bom_id, bl.material_id, m.code AS material_code,
             m.name AS material_name, bl.quantity, bl.created_at
      FROM manufacturing.bom_lines bl
      JOIN core.materials m ON m.company_id = bl.company_id AND m.id = bl.material_id
      WHERE bl.company_id = $1 AND bl.bom_id = $2
      ORDER BY bl.material_id
    `,
    [companyId, row.rows[0].id],
  );

  const bom = row.rows[0];
  return {
    id: bom.id,
    companyId: bom.company_id,
    productMaterialId: bom.product_material_id,
    productMaterialCode: bom.product_material_code,
    productMaterialName: bom.product_material_name,
    quantityPerBatch: Number(bom.quantity_per_batch),
    description: bom.description,
    status: bom.status,
    createdBy: bom.created_by,
    createdAt: new Date(bom.created_at).toISOString(),
    updatedAt: new Date(bom.updated_at).toISOString(),
    lines: lines.rows.map(mapBomLine),
  };
};

export const insertBom = async (
  client: PoolClient,
  companyId: string,
  createdBy: string,
  productMaterialId: string,
  quantityPerBatch: number,
  description: string | null,
): Promise<{ id: string }> => {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO manufacturing.boms (
        company_id,
        product_material_id,
        quantity_per_batch,
        description,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
      RETURNING id
    `,
    [companyId, productMaterialId, quantityPerBatch, description, createdBy],
  );

  return result.rows[0];
};

export const insertBomLine = async (
  client: PoolClient,
  companyId: string,
  bomId: string,
  materialId: string,
  quantity: number,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO manufacturing.bom_lines (
        company_id,
        bom_id,
        material_id,
        quantity
      )
      VALUES ($1, $2, $3, $4)
    `,
    [companyId, bomId, materialId, quantity],
  );
};

export const listCompanyProductionOrders = async (companyId: string): Promise<ProductionOrder[]> => {
  const rows = await db.query<ProductionOrderRow>(
    `
      SELECT po.id, po.company_id, po.bom_id, po.plant_id, b.product_material_id,
             pm.code AS product_material_code, pm.name AS product_material_name,
             po.document_number, po.status, po.planned_quantity, po.produced_quantity,
             po.description, po.created_by, po.created_at, po.updated_at, po.completed_at
      FROM manufacturing.production_orders po
      JOIN manufacturing.boms b ON b.company_id = po.company_id AND b.id = po.bom_id
      JOIN core.materials pm ON pm.company_id = po.company_id AND pm.id = b.product_material_id
      WHERE po.company_id = $1
      ORDER BY po.created_at DESC, po.document_number DESC
    `,
    [companyId],
  );

  return rows.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    bomId: row.bom_id,
    plantId: row.plant_id,
    productMaterialId: row.product_material_id,
    productMaterialCode: row.product_material_code,
    productMaterialName: row.product_material_name,
    documentNumber: row.document_number,
    status: row.status,
    plannedQuantity: Number(row.planned_quantity),
    producedQuantity: Number(row.produced_quantity),
    description: row.description,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  }));
};

export const getProductionOrderById = async (
  client: PoolClient,
  companyId: string,
  orderId: string,
): Promise<ProductionOrder | null> => {
  const row = await client.query<ProductionOrderRow>(
    `
      SELECT po.id, po.company_id, po.bom_id, po.plant_id, b.product_material_id,
             pm.code AS product_material_code, pm.name AS product_material_name,
             po.document_number, po.status, po.planned_quantity, po.produced_quantity,
             po.description, po.created_by, po.created_at, po.updated_at, po.completed_at
      FROM manufacturing.production_orders po
      JOIN manufacturing.boms b ON b.company_id = po.company_id AND b.id = po.bom_id
      JOIN core.materials pm ON pm.company_id = po.company_id AND pm.id = b.product_material_id
      WHERE po.company_id = $1 AND po.id = $2
      LIMIT 1
    `,
    [companyId, orderId],
  );

  if (!row.rows[0]) {
    return null;
  }

  const current = row.rows[0];
  return {
    id: current.id,
    companyId: current.company_id,
    bomId: current.bom_id,
    plantId: current.plant_id,
    productMaterialId: current.product_material_id,
    productMaterialCode: current.product_material_code,
    productMaterialName: current.product_material_name,
    documentNumber: current.document_number,
    status: current.status,
    plannedQuantity: Number(current.planned_quantity),
    producedQuantity: Number(current.produced_quantity),
    description: current.description,
    createdBy: current.created_by,
    createdAt: new Date(current.created_at).toISOString(),
    updatedAt: new Date(current.updated_at).toISOString(),
    completedAt: current.completed_at ? new Date(current.completed_at).toISOString() : null,
  };
};

export const insertProductionOrder = async (
  client: PoolClient,
  companyId: string,
  bomId: string,
  plantId: string,
  createdBy: string,
  documentNumber: string,
  plannedQuantity: number,
  description: string | null,
): Promise<ProductionOrder> => {
  const result = await client.query<ProductionOrderRow>(
    `
      INSERT INTO manufacturing.production_orders (
        company_id,
        bom_id,
        plant_id,
        document_number,
        status,
        planned_quantity,
        description,
        created_by
      )
      VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7)
      RETURNING id, company_id, bom_id, plant_id, document_number, status,
                planned_quantity, produced_quantity, description, created_by,
                created_at, updated_at, completed_at
    `,
    [companyId, bomId, plantId, documentNumber, plannedQuantity, description, createdBy],
  );

  const current = result.rows[0];
  return {
    id: current.id,
    companyId: current.company_id,
    bomId: current.bom_id,
    plantId: current.plant_id,
    productMaterialId: "",
    productMaterialCode: "",
    productMaterialName: "",
    documentNumber: current.document_number,
    status: current.status,
    plannedQuantity: Number(current.planned_quantity),
    producedQuantity: Number(current.produced_quantity),
    description: current.description,
    createdBy: current.created_by,
    createdAt: new Date(current.created_at).toISOString(),
    updatedAt: new Date(current.updated_at).toISOString(),
    completedAt: current.completed_at ? new Date(current.completed_at).toISOString() : null,
  };
};

export const insertProductionIssue = async (
  client: PoolClient,
  companyId: string,
  orderId: string,
  materialId: string,
  storageLocationId: string,
  quantity: number,
  createdBy: string,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO manufacturing.production_order_issues (
        company_id,
        production_order_id,
        material_id,
        storage_location_id,
        quantity,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [companyId, orderId, materialId, storageLocationId, quantity, createdBy],
  );
};

export const insertProductionConfirmation = async (
  client: PoolClient,
  companyId: string,
  orderId: string,
  storageLocationId: string,
  producedQuantity: number,
  createdBy: string,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO manufacturing.production_order_confirmations (
        company_id,
        production_order_id,
        storage_location_id,
        produced_quantity,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [companyId, orderId, storageLocationId, producedQuantity, createdBy],
  );
};

export const getStockBalance = async (
  client: PoolClient,
  companyId: string,
  storageLocationId: string,
  materialId: string,
): Promise<{ quantity: number } | null> => {
  const result = await client.query<{ quantity: string }>(
    `
      SELECT quantity
      FROM inventory.stock_balances
      WHERE company_id = $1 AND storage_location_id = $2 AND material_id = $3
      LIMIT 1
    `,
    [companyId, storageLocationId, materialId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return { quantity: Number(result.rows[0].quantity) };
};

export const upsertStockBalance = async (
  client: PoolClient,
  companyId: string,
  storageLocationId: string,
  materialId: string,
  delta: number,
): Promise<void> => {
  const updated = await client.query<{ id: string }>(
    `
      UPDATE inventory.stock_balances
      SET quantity = quantity + $4,
          updated_at = NOW()
      WHERE company_id = $1
        AND storage_location_id = $2
        AND material_id = $3
      RETURNING id
    `,
    [companyId, storageLocationId, materialId, delta],
  );

  if (updated.rowCount === 0) {
    if (delta < 0) {
      throw new Error("Inventory balance could not be decremented because the material is not stocked at the location.");
    }

    await client.query(
      `
        INSERT INTO inventory.stock_balances (company_id, storage_location_id, material_id, quantity)
        VALUES ($1, $2, $3, $4)
      `,
      [companyId, storageLocationId, materialId, delta],
    );
  }
};

export const updateProductionOrder = async (
  client: PoolClient,
  companyId: string,
  orderId: string,
  status: ProductionOrder["status"],
  producedQuantity?: number,
  completedAt?: string,
): Promise<ProductionOrder> => {
  const result = await client.query<ProductionOrderRow>(
    `
      UPDATE manufacturing.production_orders
      SET status = $3,
          produced_quantity = COALESCE($4, produced_quantity),
          updated_at = NOW(),
          completed_at = COALESCE($5::timestamptz, completed_at)
      WHERE company_id = $1 AND id = $2
      RETURNING id, company_id, bom_id, plant_id, document_number, status,
                planned_quantity, produced_quantity, description, created_by,
                created_at, updated_at, completed_at
    `,
    [companyId, orderId, status, producedQuantity ?? null, completedAt ?? null],
  );

  const current = result.rows[0];
  const bom = await getBomById(client, companyId, undefined, current.bom_id);
  return {
    id: current.id,
    companyId: current.company_id,
    bomId: current.bom_id,
    plantId: current.plant_id,
    productMaterialId: bom?.productMaterialId ?? "",
    productMaterialCode: bom?.productMaterialCode ?? "",
    productMaterialName: bom?.productMaterialName ?? "",
    documentNumber: current.document_number,
    status: current.status,
    plannedQuantity: Number(current.planned_quantity),
    producedQuantity: Number(current.produced_quantity),
    description: current.description,
    createdBy: current.created_by,
    createdAt: new Date(current.created_at).toISOString(),
    updatedAt: new Date(current.updated_at).toISOString(),
    completedAt: current.completed_at ? new Date(current.completed_at).toISOString() : null,
  };
};
