import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Permission = {
  code: string;
  name: string;
};

type PlatformContext = {
  user: {
    userId: string;
    email: string;
    displayName: string;
  };
  organization: {
    id: string;
    code: string;
    name: string;
  };
  company: {
    id: string;
    code: string;
    name: string;
  };
  permissions: Permission[];
};

type ApiResponse = {
  status: "ok";
  data: PlatformContext;
};

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
    description: "Purchasing, suppliers, and procurement processes.",
    permission: "procurement.read",
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
    description: "Inventory visibility and stock management.",
    permission: "inventory.read",
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
    permission: "service.read",
  },
];

const App = () => {
  const [context, setContext] = useState<PlatformContext | null>(null);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContext = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/v1/core/context");

        if (!response.ok) {
          throw new Error(
            `Context API returned HTTP ${response.status}.`,
          );
        }

        const result = (await response.json()) as ApiResponse;

        if (result.status !== "ok") {
          throw new Error("Context API returned an invalid response.");
        }

        setContext(result.data);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to load EnterpriseX platform context.";

        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadContext();
  }, []);

  const permissionSet = useMemo(
    () => new Set(context?.permissions.map((permission) => permission.code)),
    [context],
  );

  const availableModules = modules.filter((module) =>
    permissionSet.has(module.permission),
  );

  const activeModuleDefinition = modules.find(
    (module) => module.id === activeModule,
  );

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-card">
          <div className="brand-mark">EX</div>
          <h1>EnterpriseX</h1>
          <p>Loading platform context...</p>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="app-loading">
        <div className="loading-card error-card">
          <div className="brand-mark">EX</div>
          <h1>EnterpriseX</h1>
          <p>Unable to load the EnterpriseX platform context.</p>
          <div className="error-message">
            {error ?? "Platform context is unavailable."}
          </div>
          <p className="error-help">
            Make sure the EnterpriseX API is running on port 3000.
          </p>
        </div>
      </div>
    );
  }

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
            <span className="nav-icon">⌂</span>
            <span>Dashboard</span>
          </button>

          <div className="nav-section-label">MODULES</div>

          {availableModules.map((module) => (
            <button
              key={module.id}
              className={`nav-item ${
                activeModule === module.id ? "active" : ""
              }`}
              onClick={() => setActiveModule(module.id)}
            >
              <span className="nav-icon">◆</span>
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
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="breadcrumb">EnterpriseX</div>
            <div className="page-title">
              {activeModule === "dashboard"
                ? "Dashboard"
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
          {activeModule === "dashboard" ? (
            <>
              <div className="welcome-section">
                <div>
                  <div className="eyebrow">ENTERPRISE RESOURCE PLANNING</div>
                  <h1>Welcome, {context.user.displayName}</h1>
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
                    <div className="eyebrow">AVAILABLE MODULES</div>
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
                      <div className="module-card-icon">◆</div>
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
              <div className="eyebrow">MODULE WORKSPACE</div>

              <h1>{activeModuleDefinition?.name}</h1>

              <p className="workspace-description">
                {activeModuleDefinition?.description}
              </p>

              <div className="workspace-status">
                <div className="status-dot" />
                <div>
                  <strong>Module access confirmed</strong>
                  <span>
                    Permission: {activeModuleDefinition?.permission}
                  </span>
                </div>
              </div>

              <div className="development-notice">
                <strong>Foundation V1</strong>
                <p>
                  This module workspace is currently a platform
                  foundation placeholder. Business functionality will
                  be implemented by its owning module agent.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;