import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import {
  createPlant,
  createStorageLocation,
  createWarehouse,
  listPlants,
  listStorageLocations,
  listWarehouses,
  type Plant,
  type StorageLocation,
  type Warehouse,
  type WarehouseType,
} from "../api/master-data-api";
import "./MasterDataWorkspace.css";

type Resource = "plants" | "warehouses" | "storage-locations";
type MasterDataRow = Plant | Warehouse | StorageLocation;

type ResourceTab = {
  id: Resource;
  label: string;
  readPermission: string;
  createPermission: string;
};

const resourceTabs: ResourceTab[] = [
  {
    id: "plants",
    label: "Plants",
    readPermission: "core.plants.read",
    createPermission: "core.plants.create",
  },
  {
    id: "warehouses",
    label: "Warehouses",
    readPermission: "core.warehouses.read",
    createPermission: "core.warehouses.create",
  },
  {
    id: "storage-locations",
    label: "Storage Locations",
    readPermission: "core.storage_locations.read",
    createPermission: "core.storage_locations.create",
  },
];

const warehouseTypes: WarehouseType[] = [
  "STANDARD",
  "RAW_MATERIAL",
  "FINISHED_GOODS",
  "SPARE_PARTS",
  "TRANSIT",
  "QUARANTINE",
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "The request could not be completed.";
};

const getCode = (row: MasterDataRow): string => row.code;
const getStatus = (row: MasterDataRow): string => row.status;

const getWarehouseTypeLabel = (row: Warehouse): string => {
  const type: unknown = row.warehouseType;

  if (typeof type !== "string" || type.trim().length === 0) {
    return "Unknown";
  }

  return type.replace(/_/g, " ");
};

export type MasterDataWorkspaceProps = {
  token: string;
  permissionCodes: ReadonlySet<string>;
};

export function MasterDataWorkspace({
  token,
  permissionCodes,
}: MasterDataWorkspaceProps) {
  const availableTabs = resourceTabs.filter(
    (tab) =>
      permissionCodes.has(tab.readPermission) ||
      permissionCodes.has(tab.createPermission),
  );

  const [activeResource, setActiveResource] = useState<Resource>(
    availableTabs[0]?.id ?? "plants",
  );

  const selectedTab =
    availableTabs.find((tab) => tab.id === activeResource) ??
    availableTabs[0];

  const [rows, setRows] = useState<MasterDataRow[]>([]);
  const [parentRows, setParentRows] = useState<Array<Plant | Warehouse>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [parentId, setParentId] = useState("");
  const [warehouseType, setWarehouseType] =
    useState<WarehouseType>("STANDARD");

  useEffect(() => {
    if (!selectedTab) {
      setRows([]);
      setParentRows([]);
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMessage(null);

    const load = async (): Promise<void> => {
      try {
        if (selectedTab.id === "plants") {
          const plants = permissionCodes.has("core.plants.read")
            ? await listPlants(token)
            : [];

          if (active) {
            setRows(plants);
            setParentRows([]);
          }

          return;
        }

        if (selectedTab.id === "warehouses") {
          const [warehouses, plants] = await Promise.all([
            permissionCodes.has("core.warehouses.read")
              ? listWarehouses(token)
              : Promise.resolve([]),
            permissionCodes.has("core.plants.read")
              ? listPlants(token)
              : Promise.resolve([]),
          ]);

          if (active) {
            setRows(warehouses);
            setParentRows(plants);
          }

          return;
        }

        const [locations, warehouses] = await Promise.all([
          permissionCodes.has("core.storage_locations.read")
            ? listStorageLocations(token)
            : Promise.resolve([]),
          permissionCodes.has("core.warehouses.read")
            ? listWarehouses(token)
            : Promise.resolve([]),
        ]);

        if (active) {
          setRows(locations);
          setParentRows(warehouses);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(getErrorMessage(error));
          setRows([]);
          setParentRows([]);
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
  }, [activeResource, permissionCodes, refreshKey, token]);

  const canCreate = Boolean(
    selectedTab &&
      permissionCodes.has(selectedTab.createPermission),
  );

  const hasParentReadPermission =
    activeResource === "warehouses"
      ? permissionCodes.has("core.plants.read")
      : activeResource === "storage-locations"
        ? permissionCodes.has("core.warehouses.read")
        : true;

  const resetForm = (): void => {
    setCode("");
    setName("");
    setAddressLine1("");
    setCity("");
    setCountryCode("");
    setParentId("");
    setWarehouseType("STANDARD");
  };

  const handleResourceChange = (resource: Resource): void => {
    setActiveResource(resource);
    setShowForm(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    resetForm();
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!selectedTab || !canCreate) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (activeResource === "plants") {
        await createPlant(token, {
          code,
          name,
          addressLine1,
          city,
          countryCode,
        });

        setSuccessMessage("Plant created.");
      } else if (activeResource === "warehouses") {
        await createWarehouse(token, {
          plantId: parentId,
          code,
          name,
          warehouseType,
        });

        setSuccessMessage("Warehouse created.");
      } else {
        await createStorageLocation(token, {
          warehouseId: parentId,
          code,
          name,
        });

        setSuccessMessage("Storage location created.");
      }

      resetForm();
      setShowForm(false);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (availableTabs.length === 0) {
    return (
      <section className="master-data-access-empty" role="status">
        <h2>Core Master Data</h2>
        <p>
          Your account does not have read access to Plants, Warehouses, or
          Storage Locations.
        </p>
      </section>
    );
  }

  return (
    <section className="master-data-page">
      <header className="master-data-header">
        <div>
          <div className="master-data-eyebrow">CORE PLATFORM</div>
          <h1>Master Data</h1>
        </div>

        {canCreate && (
          <button
            type="button"
            className="master-data-primary"
            onClick={() => {
              setShowForm((current) => !current);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
          >
            {showForm
              ? "Close form"
              : `Create ${selectedTab?.label.replace(/s$/, "")}`}
          </button>
        )}
      </header>

      <div className="master-data-toolbar">
        <div
          className="master-data-tabs"
          role="tablist"
          aria-label="Master data resources"
        >
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeResource === tab.id}
              className={activeResource === tab.id ? "selected" : ""}
              onClick={() => handleResourceChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="master-data-refresh"
          aria-label="Refresh master data"
          title="Refresh"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading}
        >
          ↻
        </button>
      </div>

      {(errorMessage || successMessage) && (
        <div
          className={
            errorMessage
              ? "master-data-notice error"
              : "master-data-notice success"
          }
          role={errorMessage ? "alert" : "status"}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <div className={`master-data-layout ${showForm ? "form-open" : ""}`}>
        <section
          className="master-data-list"
          aria-label={`${selectedTab?.label} list`}
        >
          <div className="master-data-list-heading">
            <h2>{selectedTab?.label}</h2>
            <span>{loading ? "Loading" : `${rows.length} records`}</span>
          </div>

          {loading ? (
            <div className="master-data-state" role="status">
              Loading {selectedTab?.label.toLowerCase()}...
            </div>
          ) : selectedTab &&
            !permissionCodes.has(selectedTab.readPermission) ? (
            <div className="master-data-state">
              List permission is not assigned for this resource.
            </div>
          ) : errorMessage ? (
            <div className="master-data-state">Unable to load records.</div>
          ) : rows.length === 0 ? (
            <div className="master-data-state">
              <strong>No {selectedTab?.label.toLowerCase()} yet</strong>
              <span>Records for the selected company will appear here.</span>
            </div>
          ) : (
            <div className="master-data-table-wrap">
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    {activeResource !== "plants" && (
                      <th>
                        {activeResource === "warehouses"
                          ? "Plant"
                          : "Warehouse"}
                      </th>
                    )}
                    {activeResource === "warehouses" && <th>Type</th>}
                    {activeResource === "plants" && <th>Location</th>}
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="master-data-code">{getCode(row)}</td>
                      <td>{row.name}</td>

                      {activeResource === "warehouses" && (
                        <td>
                          {parentRows.find(
                            (plant) =>
                              plant.id === (row as Warehouse).plantId,
                          )?.code ?? "Unavailable"}
                        </td>
                      )}

                      {activeResource === "storage-locations" && (
                        <td>
                          {parentRows.find(
                            (warehouse) =>
                              warehouse.id ===
                              (row as StorageLocation).warehouseId,
                          )?.code ?? "Unavailable"}
                        </td>
                      )}

                      {activeResource === "plants" && (
                        <td>
                          {[
                            (row as Plant).city,
                            (row as Plant).countryCode,
                          ]
                            .filter(Boolean)
                            .join(", ") || "Not set"}
                        </td>
                      )}

                      {activeResource === "warehouses" && (
                        <td>{getWarehouseTypeLabel(row as Warehouse)}</td>
                      )}

                      <td>
                        <span
                          className={`master-data-status ${getStatus(row).toLowerCase()}`}
                        >
                          {getStatus(row)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showForm && canCreate && (
          <aside className="master-data-form-panel">
            <h2>Create {selectedTab?.label.replace(/s$/, "")}</h2>

            {activeResource !== "plants" && !hasParentReadPermission ? (
              <p className="master-data-form-blocked" role="status">
                Read permission for{" "}
                {activeResource === "warehouses" ? "Plants" : "Warehouses"} is
                required to select a parent record.
              </p>
            ) : (
              <form onSubmit={handleSubmit}>
                {activeResource === "warehouses" && (
                  <label>
                    Plant
                    <select
                      value={parentId}
                      onChange={(event) => setParentId(event.target.value)}
                      required
                      disabled={submitting || parentRows.length === 0}
                    >
                      <option value="">Select a plant</option>
                      {(parentRows as Plant[]).map((plant) => (
                        <option key={plant.id} value={plant.id}>
                          {plant.code} · {plant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {activeResource === "storage-locations" && (
                  <label>
                    Warehouse
                    <select
                      value={parentId}
                      onChange={(event) => setParentId(event.target.value)}
                      required
                      disabled={submitting || parentRows.length === 0}
                    >
                      <option value="">Select a warehouse</option>
                      {(parentRows as Warehouse[]).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} · {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Code
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    maxLength={50}
                    required
                    disabled={submitting}
                  />
                </label>

                <label>
                  Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={255}
                    required
                    disabled={submitting}
                  />
                </label>

                {activeResource === "plants" && (
                  <>
                    <label>
                      Address
                      <input
                        value={addressLine1}
                        onChange={(event) =>
                          setAddressLine1(event.target.value)
                        }
                        maxLength={255}
                        disabled={submitting}
                      />
                    </label>

                    <div className="master-data-form-row">
                      <label>
                        City
                        <input
                          value={city}
                          onChange={(event) => setCity(event.target.value)}
                          maxLength={100}
                          disabled={submitting}
                        />
                      </label>

                      <label>
                        Country code
                        <input
                          value={countryCode}
                          onChange={(event) =>
                            setCountryCode(event.target.value)
                          }
                          maxLength={10}
                          disabled={submitting}
                        />
                      </label>
                    </div>
                  </>
                )}

                {activeResource === "warehouses" && (
                  <label>
                    Warehouse type
                    <select
                      value={warehouseType}
                      onChange={(event) =>
                        setWarehouseType(event.target.value as WarehouseType)
                      }
                      disabled={submitting}
                    >
                      {warehouseTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {activeResource !== "plants" && parentRows.length === 0 && (
                  <p className="master-data-form-hint">
                    Create or activate a parent record before adding this item.
                  </p>
                )}

                <button
                  className="master-data-primary master-data-submit"
                  type="submit"
                  disabled={
                    submitting ||
                    (activeResource !== "plants" && parentRows.length === 0)
                  }
                >
                  {submitting ? "Saving..." : "Save record"}
                </button>
              </form>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}