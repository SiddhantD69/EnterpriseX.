import { apiRequest } from "./client";

export type StockBalance = {
  storageLocationId: string;
  storageLocationCode: string;
  warehouseId: string;
  warehouseCode: string;
  plantId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  quantity: number;
};

export type StockMovement = {
  id: string;
  storageLocationId: string;
  materialId: string;
  quantityDelta: number;
  occurredAt: string;
  goodsReceiptLineId: string;
};

export type GoodsReceipt = {
  id: string;
  companyId: string;
  purchaseOrderId: string;
  documentNumber: string;
  receivedAt: string;
  lines: Array<{
    id: string;
    purchaseOrderLineId: string;
    storageLocationId: string;
    materialId: string;
    quantity: number;
  }>;
};

const authorized = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
});

export const listStockBalances = async (token: string): Promise<StockBalance[]> =>
  (await apiRequest<{ data: StockBalance[] }>("/api/v1/inventory/stock-balances", { headers: authorized(token) })).data;

export const listStockMovements = async (token: string): Promise<StockMovement[]> =>
  (await apiRequest<{ data: StockMovement[] }>("/api/v1/inventory/stock-movements", { headers: authorized(token) })).data;

export const createGoodsReceipt = async (
  token: string,
  purchaseOrderId: string,
  input: { lines: Array<{ purchaseOrderLineId: string; storageLocationId: string; quantity: number }> },
): Promise<GoodsReceipt> =>
  (await apiRequest<{ data: GoodsReceipt }>(`/api/v1/inventory/purchase-orders/${purchaseOrderId}/receipts`, {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;