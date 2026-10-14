import type { MasterDataStatus } from "./warehouse.js";

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

export type CreateStorageLocationInput = {
  warehouseId: string;
  code: string;
  name: string;
};

export type UpdateStorageLocationInput = CreateStorageLocationInput & {
  status: MasterDataStatus;
};