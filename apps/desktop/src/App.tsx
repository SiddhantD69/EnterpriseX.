import { useMemo, useState } from "react";
import "./App.css";
import { useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./screens/LoginScreen";
import { CompanySelectionScreen } from "./screens/CompanySelectionScreen";
import { MasterDataWorkspace } from "./screens/MasterDataWorkspace";
import { ProcurementWorkspace } from "./screens/ProcurementWorkspace";
import { InventoryWorkspace } from "./screens/InventoryWorkspace";
import { CatalogWorkspace } from "./screens/CatalogWorkspace";
import { FinanceWorkspace } from "./screens/FinanceWorkspace";
import { AssetManagementWorkspace } from "./screens/AssetManagementWorkspace";

type ModuleDefinition = {
  id: string;
  name: string;
  description: string;
  permission: string;
};

const modules: ModuleDefinition[] = [
  {
    id: "finance",
    name: "Finance",
    description: "Financial accounting and enterprise financial operations.",
    permission: "finance.read",
  },
  {
    id: "procurement",
    name: "Procurement",
    description: "Requisitions, purchase orders, receipts, and invoice matching.",
    permission: "procurement.requisitions.read",
  },
  {
    id: "supply-chain",
    name: "Supply Chain",
    description: "Supply planning and connected supply chain operations.",
    permission: "supply_chain.read",
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Company stock balances, movements, and goods receipts.",
    permission: "inventory.stock.read",
  },
  {
    id: "warehouse",
    name: "Warehouse",
    description: "Warehouse execution and inventory movement.",
    permission: "warehouse.read",
  },
  {
    id: "sales",
    name: "Sales",
    description: "Sales processes, customers, and commercial operations.",
    permission: "sales.read",
  },
  {
    id: "crm",
    name: "CRM",
    description: "Customer relationship and engagement management.",
    permission: "crm.read",
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    description: "Manufacturing planning and execution.",
    permission: "manufacturing.read",
  },
  {
    id: "hr",
    name: "HR",
    description: "Human resources and workforce operations.",
    permission: "hr.read",
  },
  {
    id: "assets",
    name: "Asset Management",
    description: "Enterprise asset lifecycle and maintenance operations.",
    permission: "assets.read",
  },
  {
    id: "projects",
    name: "Projects",
    description: "Project planning, execution, and financial control.",
    permission: "projects.read",
  },
  {
    id: "service",
    name: "Service Management",
    description: "Enterprise service management and service operations.",
    permission: "services.read",
  },
];

function App() {
  const {
    state,
    authenticate,
    chooseCompany,
    logout,
    isCompanySelectionLoading,
  } = useAuth();

  const [activeModule, setActiveModule] = useState("dashboard");

  const permissionSet = useMemo(() => {
    if (state.status !== "AUTHENTICATED") {
      return new Set<string>();
    }

    return new Set(
      state.context.permissions.map((permission) => permission.code),
    );
  }, [state]);

  const availableModules = modules.filter((module) => {
    if (module.id === "procurement") {
      return [
        "procurement.requisitions.read",
        "procurement.requisitions.create",
        "procurement.requisitions.update",
        "procurement.requisitions.submit",
        "procurement.purchase_orders.read",
        "procurement.purchase_orders.create",
        "procurement.supplier_invoices.read",
        "procurement.supplier_invoices.create",
        "core.suppliers.read",
        "core.suppliers.create",
        "core.materials.read",
        "core.materials.create",
        "core.currencies.read",
        "core.currencies.create",
        "core.units_of_measure.read",
        "core.units_of_measure.create",
      ].some((permission) => permissionSet.has(permission));
    }
    if (module.id === "inventory") {
      return permissionSet.has("inventory.stock.read") ||
        permissionSet.has("inventory.goods_receipts.create");
    }
    return permissionSet.has(module.permission);
  });
  const canAccessMasterData = [
    "core.plants.read",
    "core.plants.create",
    "core.warehouses.read",
    "core.warehouses.create",
    "core.warehouses.update",
    "core.storage_locations.read",
    "core.storage_locations.create",
    "core.storage_locations.update",
  ].some((permission) => permissionSet.has(permission));
  const canAccessCatalog = [
    "core.suppliers.read",
    "core.suppliers.create",
    "core.materials.read",
    "core.materials.create",
    "core.currencies.read",
    "core.currencies.create",
    "core.units_of_measure.read",
    "core.units_of_measure.create",
  ].some((permission) => permissionSet.has(permission));

  const activeModuleDefinition = modules.find(
    (module) => module.id === activeModule,
  );

  if (state.status === "LOGGED_OUT") {
    return (
      <LoginScreen
        onLogin={authenticate}
        errorMessage={null}
        isLoading={false}
      />
    );
  }

  if (state.status === "AUTHENTICATING") {
    return (
      <div className="app-loading">
        <div className="loading-card">
          <div className="brand-mark">EX</div>
          <h1>EnterpriseX</h1>
          <p>Signing in...</p>
        </div>
      </div>
    );
  }

  if (state.status === "ERROR") {
    return (
      <LoginScreen
        onLogin={authenticate}
        errorMessage={state.message}
        isLoading={false}
      />
    );
  }

  if (state.status === "COMPANY_SELECTION_REQUIRED") {
    return (
      <CompanySelectionScreen
        companies={state.companies}
        onSelectCompany={chooseCompany}
        isLoading={isCompanySelectionLoading}
        errorMessage={null}
      />
    );
  }

  if (state.status === "LOADING_CONTEXT") {
    return (
      <div className="app-loading">
        <div className="loading-card">
          <div className="brand-mark">EX</div>
          <h1>EnterpriseX</h1>
          <p>Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (state.status !== "AUTHENTICATED") {
    return null;
  }

  const { context, session } = state;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EX</div>

          <div>
            <div className="brand-name">EnterpriseX</div>
            <div className="brand-subtitle">ERP Platform</div>
          </div>
        </div>

        <div className="context-card">
          <div className="context-label">COMPANY</div>

          <div className="context-company">
            {context.company.name}
          </div>

          <div className="context-code">
            {context.company.code}
          </div>
        </div>

        <nav className="navigation">
          <button
            className={`nav-item ${
              activeModule === "dashboard" ? "active" : ""
            }`}
            onClick={() => setActiveModule("dashboard")}
          >
            <span className="nav-icon">D</span>
            <span>Dashboard</span>
          </button>

          {canAccessMasterData && (
            <button
              className={`nav-item ${
                activeModule === "core-master-data" ? "active" : ""
              }`}
              onClick={() => setActiveModule("core-master-data")}
            >
              <span className="nav-icon">C</span>
              <span>Core Platform</span>
            </button>
          )}

          {canAccessCatalog && (
            <button
              className={`nav-item ${
                activeModule === "catalog-setup" ? "active" : ""
              }`}
              onClick={() => setActiveModule("catalog-setup")}
            >
              <span className="nav-icon">R</span>
              <span>Purchasing Catalog</span>
            </button>
          )}

          {availableModules.length > 0 && (
            <div className="nav-section-label">MODULES</div>
          )}

          {availableModules.map((module) => (
            <button
              key={module.id}
              className={`nav-item ${
                activeModule === module.id ? "active" : ""
              }`}
              onClick={() => setActiveModule(module.id)}
            >
              <span className="nav-icon">M</span>
              <span>{module.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">
              {context.user.displayName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div className="user-details">
              <div className="user-name">
                {context.user.displayName}
              </div>

              <div className="user-email">
                {context.user.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="breadcrumb">EnterpriseX</div>

            <div className="page-title">
              {activeModule === "dashboard"
                ? "Dashboard"
                : activeModule === "core-master-data"
                  ? "Core Platform"
                  : activeModule === "catalog-setup"
                    ? "Purchasing Catalog"
                  : activeModuleDefinition?.name}
            </div>
          </div>

          <div className="topbar-context">
            <div className="organization-context">
              <span className="context-small-label">
                ORGANIZATION
              </span>

              <span>{context.organization.code}</span>
            </div>

            <div className="status-indicator">
              <span className="status-dot" />
              Connected
            </div>
          </div>
        </header>

        <section className="workspace">
          {activeModule === "core-master-data" ? (
            <MasterDataWorkspace
              token={session.token}
              permissionCodes={permissionSet}
            />
          ) : activeModule === "catalog-setup" ? (
            <CatalogWorkspace
              token={session.token}
              permissionCodes={permissionSet}
            />
          ) : activeModule === "procurement" ? (
            <ProcurementWorkspace
              token={session.token}
              permissionCodes={permissionSet}
            />
          ) : activeModule === "inventory" ? (
            <InventoryWorkspace
              token={session.token}
              permissionCodes={permissionSet}
            />
          ) : activeModule === "finance" ? (
            <FinanceWorkspace
              token={session.token}
              permissionCodes={permissionSet}
            />
          ) : activeModule === "assets" || activeModule === "projects" || activeModule === "service" ? (
            <AssetManagementWorkspace
              token={session.token}
              permissionCodes={permissionSet}
            />
          ) : activeModule === "dashboard" ? (
            <>
              <div className="welcome-section">
                <div>
                  <div className="eyebrow">
                    ENTERPRISE RESOURCE PLANNING
                  </div>

                  <h1>
                    Welcome, {context.user.displayName}
                  </h1>

                  <p>
                    Your EnterpriseX workspace is connected to the
                    development platform context.
                  </p>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <div className="card-label">COMPANY</div>

                  <div className="card-value">
                    {context.company.code}
                  </div>

                  <div className="card-description">
                    {context.company.name}
                  </div>
                </div>

                <div className="dashboard-card">
                  <div className="card-label">ORGANIZATION</div>

                  <div className="card-value">
                    {context.organization.code}
                  </div>

                  <div className="card-description">
                    {context.organization.name}
                  </div>
                </div>

                <div className="dashboard-card">
                  <div className="card-label">PERMISSIONS</div>

                  <div className="card-value">
                    {context.permissions.length}
                  </div>

                  <div className="card-description">
                    Active platform permissions
                  </div>
                </div>
              </div>

              <div className="module-section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">
                      AVAILABLE MODULES
                    </div>

                    <h2>EnterpriseX Workspace</h2>
                  </div>
                </div>

                <div className="module-grid">
                  {availableModules.map((module) => (
                    <button
                      key={module.id}
                      className="module-card"
                      onClick={() => setActiveModule(module.id)}
                    >
                      <div className="module-card-icon">M</div>

                      <div className="module-card-name">
                        {module.name}
                      </div>

                      <div className="module-card-description">
                        {module.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="module-workspace">
              <div className="eyebrow">
                MODULE WORKSPACE
              </div>

              <h1>{activeModuleDefinition?.name}</h1>

              <p className="workspace-description">
                {activeModuleDefinition?.description}
              </p>

              <div className="workspace-status">
                <div className="status-dot" />

                <div>
                  <strong>
                    Module access confirmed
                  </strong>

                  <span>
                    Permission:{" "}
                    {activeModuleDefinition?.permission}
                  </span>
                </div>
              </div>

              <div className="development-notice">
                <strong>Foundation V1</strong>

                <p>
                  This module workspace is currently a platform
                  foundation placeholder. Business functionality
                  will be implemented by its owning module agent.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;