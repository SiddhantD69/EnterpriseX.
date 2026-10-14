import { ApiError, apiRequest } from "./client";

export type Plant = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type WarehouseType =
  | "STANDARD"
  | "RAW_MATERIAL"
  | "FINISHED_GOODS"
  | "SPARE_PARTS"
  | "TRANSIT"
  | "QUARANTINE";

export type MasterDataStatus = "ACTIVE" | "INACTIVE";

export type Warehouse = {
  id: string;
  companyId: string;
  plantId: string;
  code: string;
  name: string;
  warehouseType: WarehouseType;
  status: MasterDataStatus;
  createdAt: string;
  updatedAt: string;
};

export type StorageLocation = {
  id: string;
  companyId: string;
  warehouseId: string;
  code: string;
  name: string;
  status: MasterDataStatus;
  createdAt: string;
  updatedAt: string;
};

type DataResponse<T> = {
  data: T;
};

const WAREHOUSE_TYPES = new Set<WarehouseType>([
  "STANDARD",
  "RAW_MATERIAL",
  "FINISHED_GOODS",
  "SPARE_PARTS",
  "TRANSIT",
  "QUARANTINE",
]);

const isWarehouse = (value: unknown): value is Warehouse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Warehouse>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.companyId === "string" &&
    typeof candidate.plantId === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.warehouseType === "string" &&
    WAREHOUSE_TYPES.has(candidate.warehouseType as WarehouseType) &&
    (candidate.status === "ACTIVE" || candidate.status === "INACTIVE") &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
};

const invalidWarehouseResponse = (): ApiError =>
  new ApiError(
    "Warehouse service returned an invalid response.",
    502,
    "INVALID_API_RESPONSE",
  );

const parseWarehouseList = (value: unknown): Warehouse[] => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("data" in value) ||
    !Array.isArray(value.data) ||
    !value.data.every(isWarehouse)
  ) {
    throw invalidWarehouseResponse();
  }

  return value.data;
};

const parseWarehouse = (value: unknown): Warehouse => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("data" in value) ||
    !isWarehouse(value.data)
  ) {
    throw invalidWarehouseResponse();
  }

  return value.data;
};

const authorized = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
});

export const listPlants = async (
  token: string,
): Promise<Plant[]> => {
  const response = await apiRequest<DataResponse<Plant[]>>(
    "/api/v1/core/plants",
    { headers: authorized(token) },
  );
  return response.data;
};

export const createPlant = async (
  token: string,
  input: {
    code: string;
    name: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  },
): Promise<Plant> => {
  const response = await apiRequest<DataResponse<Plant>>(
    "/api/v1/core/plants",
    {
      method: "POST",
      headers: authorized(token),
      body: JSON.stringify(input),
    },
  );
  return response.data;
};

export const listWarehouses = async (
  token: string,
): Promise<Warehouse[]> => {
  const response = await apiRequest<unknown>(
    "/api/v1/core/warehouses",
    { headers: authorized(token) },
  );
  return parseWarehouseList(response);
};

export const createWarehouse = async (
  token: string,
  input: {
    plantId: string;
    code: string;
    name: string;
    warehouseType: WarehouseType;
  },
): Promise<Warehouse> => {
  const response = await apiRequest<unknown>(
    "/api/v1/core/warehouses",
    {
      method: "POST",
      headers: authorized(token),
      body: JSON.stringify(input),
    },
  );
  return parseWarehouse(response);
};

export const listStorageLocations = async (
  token: string,
): Promise<StorageLocation[]> => {
  const response = await apiRequest<DataResponse<StorageLocation[]>>(
    "/api/v1/core/storage-locations",
    { headers: authorized(token) },
  );
  return response.data;
};

export const createStorageLocation = async (
  token: string,
  input: {
    warehouseId: string;
    code: string;
    name: string;
  },
): Promise<StorageLocation> => {
  const response = await apiRequest<DataResponse<StorageLocation>>(
    "/api/v1/core/storage-locations",
    {
      method: "POST",
      headers: authorized(token),
      body: JSON.stringify(input),
    },
  );
  return response.data;
};