import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import {
  createAsset,
  createProject,
  createService,
  listAssets,
  listProjects,
  listServices,
  type AssetRecord,
  type ProjectRecord,
  type ServiceRecord,
} from "../api/asset-management-api";

const getErrorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : "The request could not be completed.";

export type AssetManagementWorkspaceProps = {
  token: string;
  permissionCodes: ReadonlySet<string>;
};

export function AssetManagementWorkspace({ token, permissionCodes }: AssetManagementWorkspaceProps) {
  type AssetTab = "assets" | "projects" | "services";

  const tabs = useMemo(() => {
    const options: Array<{ id: AssetTab; label: string; permission: string }> = [
      { id: "assets", label: "Assets", permission: "assets.read" },
      { id: "projects", label: "Projects", permission: "projects.read" },
      { id: "services", label: "Services", permission: "services.read" },
    ];

    return options.filter((tab) => permissionCodes.has(tab.permission));
  }, [permissionCodes]);

  const [activeTab, setActiveTab] = useState<AssetTab>(tabs[0]?.id ?? "assets");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [assetForm, setAssetForm] = useState({ code: "", name: "", category: "EQUIPMENT" as AssetRecord["category"], status: "ACTIVE" as AssetRecord["status"], cost: "", location: "", description: "" });
  const [projectForm, setProjectForm] = useState({ code: "", name: "", status: "PLANNED" as ProjectRecord["status"], managerUserId: "", startDate: "", endDate: "", budget: "", description: "" });
  const [serviceForm, setServiceForm] = useState({ projectId: "", assetId: "", code: "", name: "", status: "OPEN" as ServiceRecord["status"], priority: "MEDIUM" as ServiceRecord["priority"], description: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async (): Promise<void> => {
      try {
        const [assetList, projectList, serviceList] = await Promise.all([
          permissionCodes.has("assets.read") ? listAssets(token) : Promise.resolve([]),
          permissionCodes.has("projects.read") ? listProjects(token) : Promise.resolve([]),
          permissionCodes.has("services.read") ? listServices(token) : Promise.resolve([]),
        ]);

        if (active) {
          setAssets(assetList);
          setProjects(projectList);
          setServices(serviceList);
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [permissionCodes, refreshKey, token]);

  const handleCreateAsset = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!permissionCodes.has("assets.create")) {
      setError("You do not have permission to create assets.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createAsset(token, {
        code: assetForm.code,
        name: assetForm.name,
        category: assetForm.category,
        status: assetForm.status,
        cost: Number(assetForm.cost || 0),
        location: assetForm.location || null,
        description: assetForm.description || null,
      });
      setAssetForm({ code: "", name: "", category: "EQUIPMENT", status: "ACTIVE", cost: "", location: "", description: "" });
      setSuccess("Asset created successfully.");
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!permissionCodes.has("projects.create")) {
      setError("You do not have permission to create projects.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createProject(token, {
        code: projectForm.code,
        name: projectForm.name,
        status: projectForm.status,
        managerUserId: projectForm.managerUserId || null,
        startDate: projectForm.startDate || null,
        endDate: projectForm.endDate || null,
        budget: Number(projectForm.budget || 0),
        description: projectForm.description || null,
      });
      setProjectForm({ code: "", name: "", status: "PLANNED", managerUserId: "", startDate: "", endDate: "", budget: "", description: "" });
      setSuccess("Project created successfully.");
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateService = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!permissionCodes.has("services.create")) {
      setError("You do not have permission to create service requests.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createService(token, {
        projectId: serviceForm.projectId || null,
        assetId: serviceForm.assetId || null,
        code: serviceForm.code,
        name: serviceForm.name,
        status: serviceForm.status,
        priority: serviceForm.priority,
        description: serviceForm.description || null,
      });
      setServiceForm({ projectId: "", assetId: "", code: "", name: "", status: "OPEN", priority: "MEDIUM", description: "" });
      setSuccess("Service request created successfully.");
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  if (tabs.length === 0) {
    return <section className="finance-access-empty"><h2>Asset Management</h2><p>Your account does not have asset-related permissions.</p></section>;
  }

  return (
    <section className="finance-page">
      <header className="finance-header">
        <div>
          <div className="finance-eyebrow">ASSET, PROJECT &amp; SERVICE</div>
          <h1>Asset Operations</h1>
        </div>
        <button type="button" className="finance-refresh" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          ↻ Refresh
        </button>
      </header>

      <div className="finance-tabs" role="tablist" aria-label="Asset management tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "selected" : ""} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {(error || success) && <div className={error ? "finance-notice error" : "finance-notice success"}>{error ?? success}</div>}
      {loading && <div className="finance-state">Loading asset data...</div>}

      {!loading && activeTab === "assets" && (
        <div className="finance-two-column">
          <form onSubmit={handleCreateAsset} className="finance-form">
            <h2>Create asset</h2>
            <label>
              Code
              <input value={assetForm.code} onChange={(event) => setAssetForm((current) => ({ ...current, code: event.target.value }))} />
            </label>
            <label>
              Name
              <input value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Category
              <select value={assetForm.category} onChange={(event) => setAssetForm((current) => ({ ...current, category: event.target.value as AssetRecord["category"] }))}>
                <option value="EQUIPMENT">Equipment</option>
                <option value="MACHINE">Machine</option>
                <option value="VEHICLE">Vehicle</option>
                <option value="BUILDING">Building</option>
                <option value="IT">IT</option>
                <option value="FURNITURE">Furniture</option>
              </select>
            </label>
            <label>
              Status
              <select value={assetForm.status} onChange={(event) => setAssetForm((current) => ({ ...current, status: event.target.value as AssetRecord["status"] }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="RETIRED">Retired</option>
              </select>
            </label>
            <label>
              Cost
              <input type="number" step="0.01" value={assetForm.cost} onChange={(event) => setAssetForm((current) => ({ ...current, cost: event.target.value }))} />
            </label>
            <label>
              Location
              <input value={assetForm.location} onChange={(event) => setAssetForm((current) => ({ ...current, location: event.target.value }))} />
            </label>
            <label>
              Description
              <textarea value={assetForm.description} onChange={(event) => setAssetForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Create asset"}</button>
          </form>

          <div className="finance-list">
            <h2>Assets</h2>
            {assets.length === 0 ? <p>No assets found.</p> : (
              <ul>
                {assets.map((asset) => (
                  <li key={asset.id}><strong>{asset.code}</strong> — {asset.name} ({asset.category})</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!loading && activeTab === "projects" && (
        <div className="finance-two-column">
          <form onSubmit={handleCreateProject} className="finance-form">
            <h2>Create project</h2>
            <label>
              Code
              <input value={projectForm.code} onChange={(event) => setProjectForm((current) => ({ ...current, code: event.target.value }))} />
            </label>
            <label>
              Name
              <input value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Status
              <select value={projectForm.status} onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value as ProjectRecord["status"] }))}>
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label>
              Manager user ID
              <input value={projectForm.managerUserId} onChange={(event) => setProjectForm((current) => ({ ...current, managerUserId: event.target.value }))} />
            </label>
            <label>
              Start date
              <input type="date" value={projectForm.startDate} onChange={(event) => setProjectForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label>
              End date
              <input type="date" value={projectForm.endDate} onChange={(event) => setProjectForm((current) => ({ ...current, endDate: event.target.value }))} />
            </label>
            <label>
              Budget
              <input type="number" step="0.01" value={projectForm.budget} onChange={(event) => setProjectForm((current) => ({ ...current, budget: event.target.value }))} />
            </label>
            <label>
              Description
              <textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Create project"}</button>
          </form>

          <div className="finance-list">
            <h2>Projects</h2>
            {projects.length === 0 ? <p>No projects found.</p> : (
              <ul>
                {projects.map((project) => (
                  <li key={project.id}><strong>{project.code}</strong> — {project.name} ({project.status})</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!loading && activeTab === "services" && (
        <div className="finance-two-column">
          <form onSubmit={handleCreateService} className="finance-form">
            <h2>Create service request</h2>
            <label>
              Project ID
              <input value={serviceForm.projectId} onChange={(event) => setServiceForm((current) => ({ ...current, projectId: event.target.value }))} />
            </label>
            <label>
              Asset ID
              <input value={serviceForm.assetId} onChange={(event) => setServiceForm((current) => ({ ...current, assetId: event.target.value }))} />
            </label>
            <label>
              Code
              <input value={serviceForm.code} onChange={(event) => setServiceForm((current) => ({ ...current, code: event.target.value }))} />
            </label>
            <label>
              Name
              <input value={serviceForm.name} onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Status
              <select value={serviceForm.status} onChange={(event) => setServiceForm((current) => ({ ...current, status: event.target.value as ServiceRecord["status"] }))}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="HOLD">On hold</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
            <label>
              Priority
              <select value={serviceForm.priority} onChange={(event) => setServiceForm((current) => ({ ...current, priority: event.target.value as ServiceRecord["priority"] }))}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            <label>
              Description
              <textarea value={serviceForm.description} onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Create service"}</button>
          </form>

          <div className="finance-list">
            <h2>Service requests</h2>
            {services.length === 0 ? <p>No service requests found.</p> : (
              <ul>
                {services.map((service) => (
                  <li key={service.id}><strong>{service.code}</strong> — {service.name} ({service.priority})</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
