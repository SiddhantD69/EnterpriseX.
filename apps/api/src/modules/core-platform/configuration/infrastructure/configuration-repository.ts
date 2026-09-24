import { db } from "../../../../infrastructure/database/pool.js";

import type {
  ConfigurationDefinition,
  ConfigurationScopeType,
  ConfigurationValue,
} from "../domain/configuration.js";

type DefinitionRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  owner_module: string;
  data_type:
    | "STRING"
    | "INTEGER"
    | "DECIMAL"
    | "BOOLEAN"
    | "DATE"
    | "DATETIME"
    | "JSON";
  default_value: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type ValueRow = {
  id: string;
  configuration_definition_id: string;
  scope_type:
    | "SYSTEM"
    | "ORGANIZATION"
    | "COMPANY";
  scope_id: string | null;
  value: string | null;
};

export type ConfigurationUpsertResult = {
  previousValue: ConfigurationValue | null;
  currentValue: ConfigurationValue;
};

const mapDefinition = (
  row: DefinitionRow,
): ConfigurationDefinition => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  ownerModule: row.owner_module,
  dataType: row.data_type,
  defaultValue: row.default_value,
  status: row.status,
});

const mapValue = (
  row: ValueRow,
): ConfigurationValue => ({
  id: row.id,
  configurationDefinitionId:
    row.configuration_definition_id,
  scopeType: row.scope_type,
  scopeId: row.scope_id,
  value: row.value,
});

export const findDefinitionByKey = async (
  key: string,
): Promise<ConfigurationDefinition | null> => {
  const result = await db.query<DefinitionRow>(
    `
      SELECT
        id,
        key,
        name,
        description,
        owner_module,
        data_type,
        default_value,
        status
      FROM core.configuration_definitions
      WHERE key = $1
        AND status = 'ACTIVE'
    `,
    [key],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return mapDefinition(result.rows[0]);
};

export const findValue = async (
  configurationDefinitionId: string,
  scopeType: ConfigurationScopeType,
  scopeId: string | null,
): Promise<ConfigurationValue | null> => {
  const result = await db.query<ValueRow>(
    `
      SELECT
        id,
        configuration_definition_id,
        scope_type,
        scope_id,
        value
      FROM core.configuration_values
      WHERE configuration_definition_id = $1
        AND scope_type = $2
        AND (
          (
            $2 = 'SYSTEM'
            AND scope_id IS NULL
          )
          OR
          (
            $2 <> 'SYSTEM'
            AND scope_id = $3
          )
        )
      LIMIT 1
    `,
    [
      configurationDefinitionId,
      scopeType,
      scopeId,
    ],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return mapValue(result.rows[0]);
};

export const upsertValue = async (
  configurationDefinitionId: string,
  scopeType: ConfigurationScopeType,
  scopeId: string | null,
  value: string,
): Promise<ConfigurationUpsertResult> => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<ValueRow>(
      `
        SELECT
          id,
          configuration_definition_id,
          scope_type,
          scope_id,
          value
        FROM core.configuration_values
        WHERE configuration_definition_id = $1
          AND scope_type = $2
          AND (
            (
              $2 = 'SYSTEM'
              AND scope_id IS NULL
            )
            OR
            (
              $2 <> 'SYSTEM'
              AND scope_id = $3
            )
          )
        FOR UPDATE
      `,
      [
        configurationDefinitionId,
        scopeType,
        scopeId,
      ],
    );

    const previousValue =
      existing.rowCount === 1
        ? mapValue(existing.rows[0])
        : null;

    let result;

    if (existing.rowCount === 1) {
      result = await client.query<ValueRow>(
        `
          UPDATE core.configuration_values
          SET
            value = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING
            id,
            configuration_definition_id,
            scope_type,
            scope_id,
            value
        `,
        [
          value,
          existing.rows[0].id,
        ],
      );
    } else {
      result = await client.query<ValueRow>(
        `
          INSERT INTO core.configuration_values (
            configuration_definition_id,
            scope_type,
            scope_id,
            value
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            configuration_definition_id,
            scope_type,
            scope_id,
            value
        `,
        [
          configurationDefinitionId,
          scopeType,
          scopeId,
          value,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      previousValue,
      currentValue: mapValue(result.rows[0]),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
