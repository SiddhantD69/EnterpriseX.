import { useMemo, useState } from "react";
import "./App.css";

type ModuleDefinition = {
  code: string;
  name: string;
  description: string;
  requiredPermissions: string[];
};

const modules: ModuleDefinition[] = [
  {
    code: "finance",
    name: "Finance",
    description: "Financial accounting, posting, and financial operations.",
    requiredPermissions: ["finance.read"],
  },
  {
    code: "procurement",
    name: "Procurement",
    description: "Purchasing and supplier-related business processes.",
    requiredPermissions: ["procurement.read"],
  },
  {
    code: "supply-chain",
    name: "Supply Chain",
    description: "Planning, replenishment, and supply chain operations.",
    requiredPermissions: ["supply_chain.read"],
  },
  {
    code: "inventory",
    name: "Inventory",
    description: "Inventory management and stock visibility.",
    requiredPermissions: ["inventory.read"],
  },
  {
    code: "warehouse",
    name: "Warehouse",
    description: "Warehouse execution and warehouse operations.",
    requiredPermissions: ["warehouse.read"],
  },
  {
    code: "sales",
    name: "Sales",
    description: "Sales processes and customer order management.",
    requiredPermissions: ["sales.read"],
  },
  {
    code: "crm",
    name: "CRM",
    description: "Customer relationship and commercial activities.",
    requiredPermissions: ["crm.read"],
  },
  {
    code: "manufacturing",
    name: "Manufacturing",
    description: "Production planning and manufacturing operations.",
    requiredPermissions: ["manufacturing.read"],
  },
  {
    code: "hr",
    name: "HR",
    description: "Human resources and workforce administration.",
    requiredPermissions: ["hr.read"],
  },
  {
    code: "assets",
    name: "Asset Management",
    description: "Enterprise asset lifecycle management.",
    requiredPermissions: ["assets.read"],
  },
  {
    code: "projects",
    name: "Projects",
    description: "Project planning, execution, and tracking.",
    requiredPermissions: ["projects.read"],
  },
  {
    code: "service",
    name: "Service Management",
    description: "Service operations and service workflows.",
    requiredPermissions: ["service.read"],
  },
];

const permissions = new Set<string>([
  "finance.read",
  "procurement.read",
  "supply_chain.read",
  "inventory.read",
  "warehouse.read",
  "sales.read",
  "crm.read",
  "manufacturing.read",
  "hr.read",
  "assets.read",
  "projects.read",
  "service.read",
]);

function App() {
  const [activeModule, setActiveModule] = useState("dashboard");

  const accessibleModules = useMemo(
    () =>
      modules.filter((module) =>
        module.requiredPermissions.every((permission) =>
          permissions.has(permission),
        ),
      ),
    [],
  );

  const selectedModule = modules.find(
    (module) => module.code === activeModule,
  );

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

        <div className="navigation-section">
          <div className="navigation-label">Workspace</div>

          <button
            className={`navigation-item ${
              activeModule === "dashboard" ? "active" : ""
            }`}
            onClick={() => setActiveModule("dashboard")}
          >
            <span className="navigation-icon">⌂</span>
            <span>Dashboard</span>
          </button>
        </div>

        <div className="navigation-section">
          <div className="navigation-label">Business Modules</div>

          {accessibleModules.map((module) => (
            <button
              key={module.code}
              className={`navigation-item ${
                activeModule === module.code ? "active" : ""
              }`}
              onClick={() => setActiveModule(module.code)}
            >
              <span className="navigation-icon">
                {module.name.charAt(0)}
              </span>
              <span>{module.name}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className={`navigation-item ${
              activeModule === "administration" ? "active" : ""
            }`}
            onClick={() => setActiveModule("administration")}
          >
            <span className="navigation-icon">⚙</span>
            <span>Administration</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="context-label">Active company</div>
            <div className="company-context">
              EnterpriseX Demo Company
            </div>
          </div>

          <div className="topbar-actions">
            <div className="system-status">
              <span className="status-dot" />
              System Online
            </div>

            <div className="user-context">
              <div className="user-avatar">SD</div>

              <div>
                <div className="user-name">Enterprise User</div>
                <div className="user-role">ERP Administrator</div>
              </div>
            </div>
          </div>
        </header>

        <section className="content">
          {activeModule === "dashboard" ? (
            <Dashboard />
          ) : activeModule === "administration" ? (
            <ModulePlaceholder
              title="Administration"
              description="System administration, configuration, security, and platform management."
            />
          ) : selectedModule ? (
            <ModulePlaceholder
              title={selectedModule.name}
              description={selectedModule.description}
            />
          ) : (
            <ModulePlaceholder
              title="Module unavailable"
              description="The requested module could not be loaded."
            />
          )}
        </section>
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Enterprise Resource Planning</div>
          <h1>Dashboard</h1>
          <p>
            Welcome to EnterpriseX. Your connected enterprise workspace.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="welcome-card">
          <div className="card-eyebrow">Current context</div>
          <h2>EnterpriseX Demo Company</h2>
          <p>
            The ERP shell is connected to the active organization and
            company context.
          </p>
        </section>

        <section className="status-card">
          <div className="card-eyebrow">Platform status</div>
          <div className="status-value">
            <span className="status-dot large" />
            Operational
          </div>
          <p>Core application services are available.</p>
        </section>

        <section className="dashboard-card">
          <div className="card-eyebrow">Architecture</div>
          <h3>Modular Monolith</h3>
          <p>
            EnterpriseX is being built with explicit module boundaries
            around a shared authoritative data model.
          </p>
        </section>

        <section className="dashboard-card">
          <div className="card-eyebrow">Data platform</div>
          <h3>PostgreSQL</h3>
          <p>
            Transactional ERP data is maintained in the authoritative
            PostgreSQL database.
          </p>
        </section>
      </div>

      <section className="principle-card">
        <div>
          <div className="card-eyebrow">EnterpriseX principle</div>
          <h2>One system → One data model → Connected processes</h2>
        </div>

        <p>
          Business modules will be introduced incrementally while the
          platform preserves shared context, security, auditability, and
          consistent data ownership.
        </p>
      </section>
    </>
  );
}

type ModulePlaceholderProps = {
  title: string;
  description: string;
};

function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <div className="module-placeholder">
      <div className="placeholder-icon">EX</div>

      <div className="eyebrow">Module</div>

      <h1>{title}</h1>

      <p>{description}</p>

      <div className="coming-soon">
        <strong>Module foundation</strong>
        <span>
          This module is registered in the ERP shell and will be implemented
          by its owning domain agent.
        </span>
      </div>
    </div>
  );
}

export default App;