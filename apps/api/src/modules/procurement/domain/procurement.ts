export type RequisitionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PARTIALLY_ORDERED"
  | "ORDERED"
  | "CANCELLED";

export type PurchaseOrderStatus =
  | "OPEN"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type PurchaseRequisition = {
  id: string;
  companyId: string;
  plantId: string;
  documentNumber: string;
  status: RequisitionStatus;
  description: string | null;
  createdAt: string;
  lines: RequisitionLine[];
};

export type RequisitionLine = {
  id: string;
  lineNumber: number;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  quantity: number;
};

export type PurchaseOrder = {
  id: string;
  companyId: string;
  plantId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  currencyCode: string;
  status: PurchaseOrderStatus;
  createdAt: string;
  lines: PurchaseOrderLine[];
};

export type PurchaseOrderLine = {
  id: string;
  lineNumber: number;
  sourceRequisitionLineId: string | null;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  quantity: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  unitPrice: number;
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

export type SupplierInvoice = {
  id: string;
  companyId: string;
  purchaseOrderId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  status: "MATCHED" | "CANCELLED";
  createdAt: string;
  lines: Array<{
    id: string;
    purchaseOrderLineId: string;
    quantity: number;
    unitPrice: number;
  }>;
};

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