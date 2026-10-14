
export type PlantStatus = "ACTIVE" | "INACTIVE";

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
  status: PlantStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreatePlantInput = {
  code: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
};
