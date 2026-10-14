import { db } from "../../../infrastructure/database/pool.js";

import type { StockBalance } from "../../procurement/domain/procurement.js";

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