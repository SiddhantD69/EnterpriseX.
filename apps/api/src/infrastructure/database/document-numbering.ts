import type { PoolClient } from "pg";

export const allocateDocumentNumber = async (
  client: PoolClient,
  companyId: string,
  documentType: string,
  prefix: string,
): Promise<string> => {
  await client.query(
    `
      INSERT INTO core.document_number_sequences (
        company_id,
        document_type,
        prefix
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (company_id, document_type) DO NOTHING
    `,
    [companyId, documentType, prefix],
  );

  const result = await client.query<{
    prefix: string;
    allocated_value: string;
  }>(
    `
      UPDATE core.document_number_sequences
      SET
        next_value = next_value + 1,
        updated_at = NOW()
      WHERE company_id = $1
        AND document_type = $2
      RETURNING prefix, (next_value - 1)::text AS allocated_value
    `,
    [companyId, documentType],
  );

  const sequence = result.rows[0];
  if (!sequence) {
    throw new Error("Document number could not be allocated.");
  }

  return `${sequence.prefix}${sequence.allocated_value.padStart(6, "0")}`;
};