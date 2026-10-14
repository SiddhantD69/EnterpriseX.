
import { db } from "../../../../infrastructure/database/pool.js";
import type { PoolClient } from "pg";
import type {
  CreatePlantInput,
  Plant,
} from "../domain/plant.js";

type PlantRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: Date | string;
  updated_at: Date | string;
};

const mapPlantRow = (row: PlantRow): Plant => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  name: row.name,
  addressLine1: row.address_line_1,
  addressLine2: row.address_line_2,
  city: row.city,
  state: row.state,
  postalCode: row.postal_code,
  countryCode: row.country_code,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const plantColumns = `
  id,
  company_id,
  code,
  name,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code,
  country_code,
  status,
  created_at,
  updated_at
`;

export const listPlants = async (
  companyId: string,
): Promise<Plant[]> => {
  const result = await db.query<PlantRow>(
    `
      SELECT ${plantColumns}
      FROM core.plants
      WHERE company_id = $1
      ORDER BY code ASC
    `,
    [companyId],
  );

  return result.rows.map(mapPlantRow);
};

export const createPlant = async (
  companyId: string,
  input: CreatePlantInput,
  client?: PoolClient,
): Promise<Plant> => {
  const result = await (client ?? db).query<PlantRow>(
    `
      INSERT INTO core.plants (
        company_id,
        code,
        name,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${plantColumns}
    `,
    [
      companyId,
      input.code,
      input.name,
      input.addressLine1 ?? null,
      input.addressLine2 ?? null,
      input.city ?? null,
      input.state ?? null,
      input.postalCode ?? null,
      input.countryCode ?? null,
    ],
  );

  const plant = result.rows[0];

  if (!plant) {
    throw new Error("Plant creation returned no record.");
  }

  return mapPlantRow(plant);
};
