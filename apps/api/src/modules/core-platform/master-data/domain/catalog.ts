export type CatalogStatus = "ACTIVE" | "INACTIVE";

export type Supplier = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  email: string | null;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
};

export type Material = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  baseUnitCode: string;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
};

export type Currency = {
  code: string;
  name: string;
  decimalPlaces: number;
  status: CatalogStatus;
};

export type UnitOfMeasure = {
  code: string;
  name: string;
  decimalPlaces: number;
  status: CatalogStatus;
};