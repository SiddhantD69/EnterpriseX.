
import Fastify from "fastify";
import cors from "@fastify/cors";

import { env } from "./config/env.js";
import { db } from "./infrastructure/database/pool.js";

import { registerCoreContextRoute } from "./modules/core-platform/api/core-context-route.js";
import { registerOrganizationCompanyRoutes } from "./modules/core-platform/api/organization-company-route.js";
import { registerConfigurationRoutes } from "./modules/core-platform/configuration/api/configuration-route.js";
import { registerAuditRoutes } from "./modules/core-platform/audit/api/audit-route.js";
import { registerPlantRoutes } from "./modules/core-platform/master-data/api/plant-route.js";
import { registerWarehouseRoutes } from "./modules/core-platform/master-data/api/warehouse-route.js";
import { registerStorageLocationRoutes } from "./modules/core-platform/master-data/api/storage-location-route.js";
import { registerCatalogRoutes } from "./modules/core-platform/master-data/api/catalog-route.js";
import { registerProcurementRoutes } from "./modules/procurement/api/procurement-route.js";
import { registerInventoryRoutes } from "./modules/inventory/api/inventory-route.js";
import { registerFinanceRoutes } from "./modules/finance/api/finance-route.js";
import { registerSalesRoutes } from "./modules/sales/api/sales-route.js";
import { registerManufacturingRoutes } from "./modules/manufacturing/api/manufacturing-route.js";
import { registerHrRoutes } from "./modules/hr/api/hr-route.js";
import { registerCrmRoutes } from "./modules/crm/api/crm-route.js";
import { registerAssetManagementRoutes } from "./modules/asset-management/api/asset-management-route.js";

import { registerAuthRoutes } from "./modules/security-identity/api/auth-route.js";
import { registerCompanyContextRoutes } from "./modules/security-identity/api/company-context-route.js";
import { registerAdministrationRoutes } from "./modules/security-identity/api/administration-route.js";

export const buildApp = () => {
  const app = Fastify({
    logger: true,
  });

  void app.register(cors, {
    origin: [
      "http://localhost:1420",
      "http://127.0.0.1:1420",
      "http://tauri.localhost",
      "tauri://localhost",
    ],
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "enterprisex-api",
      environment: env.nodeEnv,
    };
  });

  app.get("/health/db", async () => {
    const result = await db.query(
      "SELECT 1 AS connected",
    );

    return {
      status: "ok",
      database: result.rows[0].connected === 1,
    };
  });

  registerCoreContextRoute(app);
  registerOrganizationCompanyRoutes(app);
  registerConfigurationRoutes(app);
  registerAuditRoutes(app);
  registerPlantRoutes(app);
  registerWarehouseRoutes(app);
  registerStorageLocationRoutes(app);
  registerCatalogRoutes(app);
  registerProcurementRoutes(app);
  registerInventoryRoutes(app);
  registerFinanceRoutes(app);
  registerSalesRoutes(app);
  registerManufacturingRoutes(app);
  registerHrRoutes(app);
  registerCrmRoutes(app);
  registerAssetManagementRoutes(app);

  registerAuthRoutes(app);
  registerCompanyContextRoutes(app);
  registerAdministrationRoutes(app);

  return app;
};
