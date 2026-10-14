const DEVELOPMENT_DEFAULT_DATABASE_PASSWORD = "change_me";

const getNonEmptyString = (
  raw: NodeJS.ProcessEnv,
  key: string,
  fallback?: string,
): string => {
  const value = raw[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${key}`);
};

const parsePort = (raw: NodeJS.ProcessEnv, key: string, fallback: number): number => {
  const value = getNonEmptyString(raw, key, String(fallback));
  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${key} must be an integer port between 1 and 65535.`);
  }

  return port;
};

export const getEnvConfig = (raw: NodeJS.ProcessEnv = process.env) => {
  const nodeEnv = (raw.NODE_ENV ?? "development").toLowerCase();
  const isProduction = nodeEnv === "production";

  const providedPassword = raw.DATABASE_PASSWORD?.trim();

  if (isProduction && (!providedPassword || providedPassword === DEVELOPMENT_DEFAULT_DATABASE_PASSWORD)) {
    throw new Error("DATABASE_PASSWORD is required in production and must not use the local development fallback.");
  }

  const databasePassword = providedPassword ?? DEVELOPMENT_DEFAULT_DATABASE_PASSWORD;

  return {
    nodeEnv,
    host: getNonEmptyString(raw, "API_HOST", "127.0.0.1"),
    port: parsePort(raw, "API_PORT", 3000),
    database: {
      host: getNonEmptyString(raw, "DATABASE_HOST", "localhost"),
      port: parsePort(raw, "DATABASE_PORT", 5432),
      name: getNonEmptyString(raw, "DATABASE_NAME", "enterprisex"),
      user: getNonEmptyString(raw, "DATABASE_USER", "enterprisex"),
      password: databasePassword,
    },
  };
};

export const env = getEnvConfig();