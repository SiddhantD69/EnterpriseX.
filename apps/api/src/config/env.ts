export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  host: process.env.API_HOST ?? "127.0.0.1",
  port: Number(process.env.API_PORT ?? 3000),

  database: {
    host: process.env.DATABASE_HOST ?? "localhost",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    name: process.env.DATABASE_NAME ?? "enterprisex",
    user: process.env.DATABASE_USER ?? "enterprisex",
    password: process.env.DATABASE_PASSWORD ?? "change_me",
  },
};