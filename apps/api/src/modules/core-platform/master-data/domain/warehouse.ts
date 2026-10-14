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

export type CreateWarehouseInput = {
  plantId: string;
  code: string;
  name: string;
  warehouseType: WarehouseType;
};

export type UpdateWarehouseInput = CreateWarehouseInput & {
  status: MasterDataStatus;
};