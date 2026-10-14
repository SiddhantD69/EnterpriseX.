import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import {
  createCurrency,
  createMaterial,
  createSupplier,
  createUnit,
  listCurrencies,
  listMaterials,
  listSuppliers,
  listUnits,
  updateCurrencyStatus,
  updateMaterialStatus,
  updateSupplierStatus,
  updateUnitStatus,
  type Currency,
  type Material,
  type Supplier,
  type UnitOfMeasure,
} from "../api/procurement-api";
import "./CatalogWorkspace.css";

type CatalogResource = "suppliers" | "materials" | "currencies" | "units";
type CatalogRow = Supplier | Material | Currency | UnitOfMeasure;

const definitions: Array<{
  id: CatalogResource;
  label: string;
  read: string;
  create: string;
  update: string;
}> = [
  { id: "suppliers", label: "Suppliers", read: "core.suppliers.read", create: "core.suppliers.create", update: "core.suppliers.update" },
  { id: "materials", label: "Materials", read: "core.materials.read", create: "core.materials.create", update: "core.materials.update" },
  { id: "currencies", label: "Currencies", read: "core.currencies.read", create: "core.currencies.create", update: "core.currencies.update" },
  { id: "units", label: "Units of Measure", read: "core.units_of_measure.read", create: "core.units_of_measure.create", update: "core.units_of_measure.update" },
];

const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : "The request could not be completed.";

const rowCode = (row: CatalogRow): string => row.code;

export type CatalogWorkspaceProps = {
  token: string;
  permissionCodes: ReadonlySet<string>;
};

export function CatalogWorkspace({ token, permissionCodes }: CatalogWorkspaceProps) {
  const visibleResources = definitions.filter((item) =>
    permissionCodes.has(item.read) || permissionCodes.has(item.create),
  );
  const [resource, setResource] = useState<CatalogResource>(visibleResources[0]?.id ?? "suppliers");
  const selected = visibleResources.find((item) => item.id === resource) ?? visibleResources[0];
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [baseUnitCode, setBaseUnitCode] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState("2");

  useEffect(() => {
    let active = true;
    if (!selected || !permissionCodes.has(selected.read)) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const load = async (): Promise<void> => {
      try {
        const [result, unitRows] = await Promise.all([
          resource === "suppliers" ? listSuppliers(token)
            : resource === "materials" ? listMaterials(token)
              : resource === "currencies" ? listCurrencies(token)
                : listUnits(token),
          permissionCodes.has("core.units_of_measure.read")
            ? listUnits(token)
            : Promise.resolve([]),
        ]);
        if (active) {
          setRows(result);
          setUnits(unitRows);
        }
      } catch (loadError) {
        if (active) {
          setError(errorMessage(loadError));
          setRows([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [permissionCodes, refreshKey, resource, token]);

  const canCreate = Boolean(selected && permissionCodes.has(selected.create));
  const canUpdate = Boolean(selected && permissionCodes.has(selected.update));

  const resetForm = (): void => {
    setCode("");
    setName("");
    setEmail("");
    setBaseUnitCode("");
    setDecimalPlaces("2");
  };

  const changeResource = (next: CatalogResource): void => {
    setResource(next);
    setFormOpen(false);
    setError(null);
    setSuccess(null);
    resetForm();
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (resource === "suppliers") {
        await createSupplier(token, { code, name, email: email || undefined });
      } else if (resource === "materials") {
        await createMaterial(token, { code, name, baseUnitCode });
      } else if (resource === "currencies") {
        await createCurrency(token, { code, name, decimalPlaces: Number(decimalPlaces) });
      } else {
        await createUnit(token, { code, name, decimalPlaces: Number(decimalPlaces) });
      }
      setSuccess(`${selected?.label.replace(/s$/, "")} created.`);
      resetForm();
      setFormOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: CatalogRow): Promise<void> => {
    if (!canUpdate) return;
    const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError(null);
    setSuccess(null);
    try {
      if (resource === "suppliers") {
        await updateSupplierStatus(token, (row as Supplier).id, nextStatus);
      } else if (resource === "materials") {
        await updateMaterialStatus(token, (row as Material).id, nextStatus);
      } else if (resource === "currencies") {
        await updateCurrencyStatus(token, row.code, nextStatus);
      } else {
        await updateUnitStatus(token, row.code, nextStatus);
      }
      setSuccess(`${row.code} is now ${nextStatus.toLowerCase()}.`);
      setRefreshKey((value) => value + 1);
    } catch (updateError) {
      setError(errorMessage(updateError));
    }
  };

  if (visibleResources.length === 0) {
    return <section className="master-data-access-empty"><h2>Purchasing Catalog</h2><p>Your account has no catalog permissions.</p></section>;
  }

  return (
    <section className="master-data-page catalog-page">
      <header className="master-data-header">
        <div><div className="master-data-eyebrow">CORE PLATFORM</div><h1>Purchasing Catalog</h1></div>
        {canCreate && <button className="master-data-primary" type="button" onClick={() => { setFormOpen((open) => !open); setError(null); setSuccess(null); }}>{formOpen ? "Close form" : `Create ${selected?.label.replace(/s$/, "")}`}</button>}
      </header>

      <div className="master-data-toolbar">
        <div className="master-data-tabs" role="tablist" aria-label="Catalog resources">
          {visibleResources.map((item) => <button key={item.id} type="button" role="tab" aria-selected={resource === item.id} className={resource === item.id ? "selected" : ""} onClick={() => changeResource(item.id)}>{item.label}</button>)}
        </div>
        <button className="master-data-refresh" type="button" aria-label="Refresh catalog" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>↻</button>
      </div>

      {(error || success) && <div className={error ? "master-data-notice error" : "master-data-notice success"} role={error ? "alert" : "status"}>{error ?? success}</div>}

      <section className="master-data-list">
        <div className="master-data-list-heading"><h2>{selected?.label}</h2><span>{loading ? "Loading" : `${rows.length} records`}</span></div>
        {loading ? <div className="master-data-state" role="status">Loading catalog...</div>
          : !selected || !permissionCodes.has(selected.read) ? <div className="master-data-state">Read permission is not assigned.</div>
            : rows.length === 0 ? <div className="master-data-state"><strong>No {selected.label.toLowerCase()} yet</strong><span>Create catalog records to use in purchasing.</span></div>
              : <div className="master-data-table-wrap"><table className="master-data-table"><thead><tr><th>Code</th><th>Name</th>{resource === "suppliers" && <th>Email</th>}{resource === "materials" && <th>Base Unit</th>}{(resource === "currencies" || resource === "units") && <th>Decimal Places</th>}<th>Status</th>{canUpdate && <th>Lifecycle</th>}</tr></thead><tbody>{rows.map((row) => <tr key={rowCode(row)}><td className="master-data-code">{rowCode(row)}</td><td>{row.name}</td>{resource === "suppliers" && <td>{(row as Supplier).email ?? "Not set"}</td>}{resource === "materials" && <td>{(row as Material).baseUnitCode}</td>}{resource === "currencies" && <td>{(row as Currency).decimalPlaces}</td>}{resource === "units" && <td>{(row as UnitOfMeasure).decimalPlaces}</td>}<td><span className={`master-data-status ${row.status.toLowerCase()}`}>{row.status}</span></td>{canUpdate && <td><button type="button" className="procurement-action" onClick={() => void toggleStatus(row)}>{row.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></td>}</tr>)}</tbody></table></div>}
      </section>

      {formOpen && canCreate && <form className="catalog-form" onSubmit={(event) => void submit(event)}>
        <h2>Create {selected?.label.replace(/s$/, "")}</h2>
        {resource === "materials" && !permissionCodes.has("core.units_of_measure.read") ? <p role="status">Unit read permission is required to choose a material base unit.</p> : <>
          <label>Code<input value={code} onChange={(event) => setCode(event.target.value)} maxLength={resource === "currencies" ? 3 : resource === "units" ? 20 : 50} required disabled={saving} /></label>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={resource === "suppliers" ? 255 : 100} required disabled={saving} /></label>
          {resource === "suppliers" && <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} disabled={saving} /></label>}
          {resource === "materials" && <label>Base unit<select value={baseUnitCode} onChange={(event) => setBaseUnitCode(event.target.value)} required disabled={saving || units.length === 0}><option value="">Select unit</option>{units.filter((unit) => unit.status === "ACTIVE").map((unit) => <option key={unit.code} value={unit.code}>{unit.code} · {unit.name}</option>)}</select></label>}
          {(resource === "currencies" || resource === "units") && <label>Decimal places<input type="number" min={0} max={resource === "currencies" ? 4 : 6} step={1} value={decimalPlaces} onChange={(event) => setDecimalPlaces(event.target.value)} required disabled={saving} /></label>}
          <button className="master-data-primary" type="submit" disabled={saving || (resource === "materials" && units.length === 0)}>{saving ? "Saving..." : "Save catalog record"}</button>
        </>}
      </form>}
    </section>
  );
}