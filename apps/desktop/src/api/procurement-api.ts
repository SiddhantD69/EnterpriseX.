import { apiRequest } from "./client";

export type Supplier = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type Material = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  baseUnitCode: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type Currency = {
  code: string;
  name: string;
  decimalPlaces: number;
  status: "ACTIVE" | "INACTIVE";
};

export type UnitOfMeasure = {
  code: string;
  name: string;
  decimalPlaces: number;
  status: "ACTIVE" | "INACTIVE";
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

export type PurchaseRequisition = {
  id: string;
  companyId: string;
  plantId: string;
  documentNumber: string;
  status: "DRAFT" | "SUBMITTED" | "PARTIALLY_ORDERED" | "ORDERED" | "CANCELLED";
  description: string | null;
  createdAt: string;
  lines: RequisitionLine[];
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

export type PurchaseOrder = {
  id: string;
  companyId: string;
  plantId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  currencyCode: string;
  status: "OPEN" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  createdAt: string;
  lines: PurchaseOrderLine[];
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

export type DataResponse<T> = { data: T };

const authorized = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
});

export const listSuppliers = async (token: string): Promise<Supplier[]> =>
  (await apiRequest<DataResponse<Supplier[]>>("/api/v1/core/suppliers", { headers: authorized(token) })).data;

export const createSupplier = async (
  token: string,
  input: { code: string; name: string; email?: string },
): Promise<Supplier> =>
  (await apiRequest<DataResponse<Supplier>>("/api/v1/core/suppliers", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listMaterials = async (token: string): Promise<Material[]> =>
  (await apiRequest<DataResponse<Material[]>>("/api/v1/core/materials", { headers: authorized(token) })).data;

export const createMaterial = async (
  token: string,
  input: { code: string; name: string; baseUnitCode: string },
): Promise<Material> =>
  (await apiRequest<DataResponse<Material>>("/api/v1/core/materials", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listCurrencies = async (token: string): Promise<Currency[]> =>
  (await apiRequest<DataResponse<Currency[]>>("/api/v1/core/currencies", { headers: authorized(token) })).data;

export const createCurrency = async (
  token: string,
  input: { code: string; name: string; decimalPlaces: number },
): Promise<Currency> =>
  (await apiRequest<DataResponse<Currency>>("/api/v1/core/currencies", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listUnits = async (token: string): Promise<UnitOfMeasure[]> =>
  (await apiRequest<DataResponse<UnitOfMeasure[]>>("/api/v1/core/units-of-measure", { headers: authorized(token) })).data;

export const createUnit = async (
  token: string,
  input: { code: string; name: string; decimalPlaces: number },
): Promise<UnitOfMeasure> =>
  (await apiRequest<DataResponse<UnitOfMeasure>>("/api/v1/core/units-of-measure", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listRequisitions = async (
  token: string,
): Promise<PurchaseRequisition[]> =>
  (await apiRequest<DataResponse<PurchaseRequisition[]>>("/api/v1/procurement/requisitions", { headers: authorized(token) })).data;

export const createRequisition = async (
  token: string,
  input: {
    plantId: string;
    description?: string;
    lines: Array<{ materialId: string; unitCode: string; quantity: number }>;
  },
): Promise<PurchaseRequisition> =>
  (await apiRequest<DataResponse<PurchaseRequisition>>("/api/v1/procurement/requisitions", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const updateRequisition = async (
  token: string,
  id: string,
  input: {
    plantId: string;
    description?: string;
    lines: Array<{ materialId: string; unitCode: string; quantity: number }>;
  },
): Promise<PurchaseRequisition> =>
  (await apiRequest<DataResponse<PurchaseRequisition>>(`/api/v1/procurement/requisitions/${id}`, {
    method: "PUT",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const submitRequisition = async (
  token: string,
  id: string,
): Promise<{ id: string; documentNumber: string; status: "SUBMITTED" }> =>
  (await apiRequest<DataResponse<{ id: string; documentNumber: string; status: "SUBMITTED" }>>(`/api/v1/procurement/requisitions/${id}/submit`, {
    method: "POST",
    headers: authorized(token),
  })).data;

export const listPurchaseOrders = async (token: string): Promise<PurchaseOrder[]> =>
  (await apiRequest<DataResponse<PurchaseOrder[]>>("/api/v1/procurement/purchase-orders", { headers: authorized(token) })).data;

export const createPurchaseOrder = async (
  token: string,
  requisitionId: string,
  input: {
    supplierId: string;
    currencyCode: string;
    unitPrices: Array<{ requisitionLineId: string; unitPrice: number }>;
  },
): Promise<{ id: string; documentNumber: string; status: "OPEN" }> =>
  (await apiRequest<DataResponse<{ id: string; documentNumber: string; status: "OPEN" }>>(`/api/v1/procurement/requisitions/${requisitionId}/purchase-order`, {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listSupplierInvoices = async (token: string): Promise<SupplierInvoice[]> =>
  (await apiRequest<DataResponse<SupplierInvoice[]>>("/api/v1/procurement/supplier-invoices", { headers: authorized(token) })).data;

export const createSupplierInvoice = async (
  token: string,
  purchaseOrderId: string,
  input: {
    supplierInvoiceNumber: string;
    lines: Array<{ purchaseOrderLineId: string; quantity: number; unitPrice: number }>;
  },
): Promise<SupplierInvoice> =>
  (await apiRequest<DataResponse<SupplierInvoice>>(`/api/v1/procurement/purchase-orders/${purchaseOrderId}/supplier-invoices`, {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const updateSupplierStatus = async (
  token: string,
  supplierId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<Supplier> =>
  (await apiRequest<DataResponse<Supplier>>(`/api/v1/core/suppliers/${supplierId}/status`, {
    method: "PUT",
    headers: authorized(token),
    body: JSON.stringify({ status }),
  })).data;

export const updateMaterialStatus = async (
  token: string,
  materialId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<Material> =>
  (await apiRequest<DataResponse<Material>>(`/api/v1/core/materials/${materialId}/status`, {
    method: "PUT",
    headers: authorized(token),
    body: JSON.stringify({ status }),
  })).data;

export const updateCurrencyStatus = async (
  token: string,
  code: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<Currency> =>
  (await apiRequest<DataResponse<Currency>>(`/api/v1/core/currencies/${encodeURIComponent(code)}/status`, {
    method: "PUT",
    headers: authorized(token),
    body: JSON.stringify({ status }),
  })).data;

export const updateUnitStatus = async (
  token: string,
  code: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<UnitOfMeasure> =>
  (await apiRequest<DataResponse<UnitOfMeasure>>(`/api/v1/core/units-of-measure/${encodeURIComponent(code)}/status`, {
    method: "PUT",
    headers: authorized(token),
    body: JSON.stringify({ status }),
  })).data;