import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import {
  createPurchaseOrder,
  createRequisition,
  createSupplierInvoice,
  listCurrencies,
  listMaterials,
  listPurchaseOrders,
  listRequisitions,
  listSupplierInvoices,
  listSuppliers,
  submitRequisition,
  updateRequisition,
  type Currency,
  type Material,
  type PurchaseOrder,
  type PurchaseRequisition,
  type Supplier,
  type SupplierInvoice,
} from "../api/procurement-api";
import { listPlants, type Plant } from "../api/master-data-api";
import "./ProcurementWorkspace.css";

type WorkspaceTab = "requisitions" | "orders" | "invoices";
type LineInput = { materialId: string; unitCode: string; quantity: string };

const getErrorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : "The request could not be completed.";

export type ProcurementWorkspaceProps = {
  token: string;
  permissionCodes: ReadonlySet<string>;
};

export function ProcurementWorkspace({
  token,
  permissionCodes,
}: ProcurementWorkspaceProps) {
  const tabs: Array<{ id: WorkspaceTab; label: string; read: string; create: string }> = [
    { id: "requisitions", label: "Requisitions", read: "procurement.requisitions.read", create: "procurement.requisitions.create" },
    { id: "orders", label: "Purchase Orders", read: "procurement.purchase_orders.read", create: "procurement.purchase_orders.create" },
    { id: "invoices", label: "Supplier Invoices", read: "procurement.supplier_invoices.read", create: "procurement.supplier_invoices.create" },
  ];
  const visibleTabs = tabs.filter((tab) => permissionCodes.has(tab.read) || permissionCodes.has(tab.create));
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(visibleTabs[0]?.id ?? "requisitions");
  const selectedTab = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];
  const canCreate = Boolean(selectedTab && permissionCodes.has(selectedTab.create));
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [editingRequisition, setEditingRequisition] = useState<string | null>(null);
  const [plantId, setPlantId] = useState("");
  const [description, setDescription] = useState("");
  const [requisitionLines, setRequisitionLines] = useState<LineInput[]>([
    { materialId: "", unitCode: "", quantity: "1" },
  ]);

  const [selectedRequisitionId, setSelectedRequisitionId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [unitPrices, setUnitPrices] = useState<Record<string, string>>({});

  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async (): Promise<void> => {
      try {
        const [reqs, orders, matchedInvoices, activePlants, activeMaterials, activeSuppliers, activeCurrencies] = await Promise.all([
          permissionCodes.has("procurement.requisitions.read") ? listRequisitions(token) : Promise.resolve([]),
          permissionCodes.has("procurement.purchase_orders.read") ? listPurchaseOrders(token) : Promise.resolve([]),
          permissionCodes.has("procurement.supplier_invoices.read") ? listSupplierInvoices(token) : Promise.resolve([]),
          permissionCodes.has("core.plants.read") ? listPlants(token) : Promise.resolve([]),
          permissionCodes.has("core.materials.read") ? listMaterials(token) : Promise.resolve([]),
          permissionCodes.has("core.suppliers.read") ? listSuppliers(token) : Promise.resolve([]),
          permissionCodes.has("core.currencies.read") ? listCurrencies(token) : Promise.resolve([]),
        ]);
        if (active) {
          setRequisitions(reqs);
          setPurchaseOrders(orders);
          setInvoices(matchedInvoices);
          setPlants(activePlants.filter((plant) => plant.status === "ACTIVE"));
          setMaterials(activeMaterials.filter((material) => material.status === "ACTIVE"));
          setSuppliers(activeSuppliers.filter((supplier) => supplier.status === "ACTIVE"));
          setCurrencies(activeCurrencies.filter((currency) => currency.status === "ACTIVE"));
        }
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [permissionCodes, refreshKey, token]);

  const submittedRequisitions = requisitions.filter((row) => row.status === "SUBMITTED");
  const invoiceableOrders = purchaseOrders.filter((order) =>
    order.lines.some((line) => line.receivedQuantity > line.invoicedQuantity),
  );
  const selectedRequisition = requisitions.find((row) => row.id === selectedRequisitionId);
  const selectedOrder = purchaseOrders.find((row) => row.id === selectedOrderId);

  const clearForm = (): void => {
    setEditingRequisition(null);
    setPlantId("");
    setDescription("");
    setRequisitionLines([{ materialId: "", unitCode: "", quantity: "1" }]);
    setSelectedRequisitionId("");
    setSupplierId("");
    setCurrencyCode("");
    setUnitPrices({});
    setSelectedOrderId("");
    setSupplierInvoiceNumber("");
  };

  const selectTab = (tab: WorkspaceTab): void => {
    setActiveTab(tab);
    setFormOpen(false);
    setError(null);
    setSuccess(null);
    clearForm();
  };

  const editRequisition = (requisition: PurchaseRequisition): void => {
    setEditingRequisition(requisition.id);
    setPlantId(requisition.plantId);
    setDescription(requisition.description ?? "");
    setRequisitionLines(requisition.lines.map((line) => ({
      materialId: line.materialId,
      unitCode: line.unitCode,
      quantity: String(line.quantity),
    })));
    setFormOpen(true);
    setError(null);
  };

  const changeLine = (index: number, changes: Partial<LineInput>): void => {
    setRequisitionLines((current) => current.map((line, lineIndex) =>
      lineIndex === index ? { ...line, ...changes } : line,
    ));
  };

  const handleRequisitionSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canCreate && !editingRequisition) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        plantId,
        description: description.trim() || undefined,
        lines: requisitionLines.map((line) => ({
          materialId: line.materialId,
          unitCode: line.unitCode,
          quantity: Number(line.quantity),
        })),
      };
      if (editingRequisition) {
        await updateRequisition(token, editingRequisition, payload);
        setSuccess("Draft requisition updated.");
      } else {
        await createRequisition(token, payload);
        setSuccess("Draft requisition created.");
      }
      setFormOpen(false);
      clearForm();
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRequisition = async (requisitionId: string): Promise<void> => {
    setError(null);
    setSuccess(null);
    try {
      await submitRequisition(token, requisitionId);
      setSuccess("Requisition submitted.");
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  const handleOrderSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedRequisition) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const order = await createPurchaseOrder(token, selectedRequisition.id, {
        supplierId,
        currencyCode,
        unitPrices: selectedRequisition.lines.map((line) => ({
          requisitionLineId: line.id,
          unitPrice: Number(unitPrices[line.id]),
        })),
      });
      setSuccess(`Purchase order ${order.documentNumber} created.`);
      setFormOpen(false);
      clearForm();
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handleInvoiceSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const lines = selectedOrder.lines
        .filter((line) => line.receivedQuantity > line.invoicedQuantity)
        .map((line) => ({
          purchaseOrderLineId: line.id,
          quantity: line.receivedQuantity - line.invoicedQuantity,
          unitPrice: line.unitPrice,
        }));
      if (lines.length === 0) throw new Error("The selected order has no uninvoiced receipts.");
      const invoice = await createSupplierInvoice(token, selectedOrder.id, {
        supplierInvoiceNumber,
        lines,
      });
      setSuccess(`Supplier invoice ${invoice.supplierInvoiceNumber} matched.`);
      setFormOpen(false);
      clearForm();
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  if (visibleTabs.length === 0) {
    return <section className="master-data-access-empty"><h2>Procurement</h2><p>Your account has no procurement permissions.</p></section>;
  }

  return (
    <section className="master-data-page procurement-page">
      <header className="master-data-header">
        <div><div className="master-data-eyebrow">SUPPLY CHAIN</div><h1>Procurement</h1></div>
        {canCreate && activeTab === "requisitions" && (
          <button className="master-data-primary" type="button" onClick={() => { clearForm(); setFormOpen((open) => !open); }}>
            {formOpen ? "Close form" : "Create requisition"}
          </button>
        )}
        {canCreate && activeTab === "orders" && (
          <button className="master-data-primary" type="button" onClick={() => { clearForm(); setFormOpen((open) => !open); }}>
            {formOpen ? "Close form" : "Create purchase order"}
          </button>
        )}
        {canCreate && activeTab === "invoices" && (
          <button className="master-data-primary" type="button" onClick={() => { clearForm(); setFormOpen((open) => !open); }}>
            {formOpen ? "Close form" : "Match supplier invoice"}
          </button>
        )}
      </header>

      <div className="master-data-toolbar">
        <div className="master-data-tabs" role="tablist" aria-label="Procurement workflows">
          {visibleTabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "selected" : ""} onClick={() => selectTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <button className="master-data-refresh" type="button" aria-label="Refresh procurement" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>↻</button>
      </div>

      {(error || success) && <div className={error ? "master-data-notice error" : "master-data-notice success"} role={error ? "alert" : "status"}>{error ?? success}</div>}
      {loading && <div className="master-data-state" role="status">Loading procurement data...</div>}

      {activeTab === "requisitions" && permissionCodes.has("procurement.requisitions.read") && !loading && (
        <section className="master-data-list">
          <div className="master-data-list-heading"><h2>Purchase Requisitions</h2><span>{requisitions.length} records</span></div>
          {requisitions.length === 0 ? <div className="master-data-state"><strong>No requisitions yet</strong><span>Create a draft to begin purchasing.</span></div> : (
            <div className="master-data-table-wrap"><table className="master-data-table">
              <thead><tr><th>Document</th><th>Plant</th><th>Status</th><th>Lines</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>{requisitions.map((row) => (
                <tr key={row.id}><td className="master-data-code">{row.documentNumber}</td><td>{plants.find((plant) => plant.id === row.plantId)?.code ?? "Unavailable"}</td><td>{row.status}</td><td>{row.lines.length}</td><td>{new Date(row.createdAt).toLocaleDateString()}</td><td>
                  {row.status === "DRAFT" && permissionCodes.has("procurement.requisitions.update") && <button type="button" className="procurement-action" onClick={() => editRequisition(row)}>Edit</button>}
                  {row.status === "DRAFT" && permissionCodes.has("procurement.requisitions.submit") && <button type="button" className="procurement-action" onClick={() => void handleSubmitRequisition(row.id)}>Submit</button>}
                </td></tr>
              ))}</tbody>
            </table></div>
          )}
          {formOpen && canCreate && (
            <form className="procurement-form" onSubmit={(event) => void handleRequisitionSubmit(event)}>
              <h3>{editingRequisition ? "Edit draft" : "New draft"}</h3>
              {!permissionCodes.has("core.plants.read") || !permissionCodes.has("core.materials.read") ? <p role="status">Plant and material read permissions are required to select requisition lines.</p> : <>
                <label>Plant<select required value={plantId} onChange={(event) => setPlantId(event.target.value)}><option value="">Select plant</option>{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.code} · {plant.name}</option>)}</select></label>
                <label>Description<input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                <div className="procurement-lines-heading"><strong>Lines</strong><button type="button" className="procurement-action" disabled={requisitionLines.length >= 100} onClick={() => setRequisitionLines((lines) => [...lines, { materialId: "", unitCode: "", quantity: "1" }])}>Add line</button></div>
                {requisitionLines.map((line, index) => (
                  <div className="procurement-line" key={`${index}-${line.materialId}`}>
                    <label>Material<select required value={line.materialId} onChange={(event) => { const material = materials.find((item) => item.id === event.target.value); changeLine(index, { materialId: event.target.value, unitCode: material?.baseUnitCode ?? "" }); }}><option value="">Select material</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.code} · {material.name}</option>)}</select></label>
                    <label>Unit<input readOnly required value={line.unitCode} /></label>
                    <label>Quantity<input required type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => changeLine(index, { quantity: event.target.value })} /></label>
                    {requisitionLines.length > 1 && <button className="procurement-action danger" type="button" aria-label="Remove line" onClick={() => setRequisitionLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))}>Remove</button>}
                  </div>
                ))}
                <button className="master-data-primary" type="submit" disabled={saving || plants.length === 0 || materials.length === 0}>{saving ? "Saving..." : editingRequisition ? "Save draft" : "Save draft"}</button>
              </>}
            </form>
          )}
        </section>
      )}

      {activeTab === "orders" && permissionCodes.has("procurement.purchase_orders.read") && !loading && (
        <section className="master-data-list">
          <div className="master-data-list-heading"><h2>Purchase Orders</h2><span>{purchaseOrders.length} records</span></div>
          {purchaseOrders.length === 0 ? <div className="master-data-state"><strong>No purchase orders yet</strong><span>Orders created from submitted requisitions will appear here.</span></div> : (
            <div className="master-data-table-wrap"><table className="master-data-table"><thead><tr><th>Document</th><th>Supplier</th><th>Plant</th><th>Currency</th><th>Status</th><th>Lines</th></tr></thead><tbody>{purchaseOrders.map((order) => <tr key={order.id}><td className="master-data-code">{order.documentNumber}</td><td>{order.supplierCode} · {order.supplierName}</td><td>{plants.find((plant) => plant.id === order.plantId)?.code ?? "Unavailable"}</td><td>{order.currencyCode}</td><td>{order.status}</td><td>{order.lines.length}</td></tr>)}</tbody></table></div>
          )}
          {formOpen && canCreate && (
            <form className="procurement-form" onSubmit={(event) => void handleOrderSubmit(event)}>
              <h3>Create from submitted requisition</h3>
              {!permissionCodes.has("procurement.requisitions.read") || !permissionCodes.has("core.suppliers.read") || !permissionCodes.has("core.currencies.read") ? <p role="status">Requisition, supplier, and currency read permissions are required.</p> : <>
                <label>Requisition<select required value={selectedRequisitionId} onChange={(event) => { setSelectedRequisitionId(event.target.value); setUnitPrices({}); }}><option value="">Select submitted requisition</option>{submittedRequisitions.map((request) => <option key={request.id} value={request.id}>{request.documentNumber}</option>)}</select></label>
                <label>Supplier<select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.name}</option>)}</select></label>
                <label>Currency<select required value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}><option value="">Select currency</option>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}</select></label>
                {selectedRequisition?.lines.map((line) => <label key={line.id}>{line.materialCode} · {line.quantity} {line.unitCode} · Unit price<input required min="0" step="0.0001" type="number" value={unitPrices[line.id] ?? ""} onChange={(event) => setUnitPrices((current) => ({ ...current, [line.id]: event.target.value }))} /></label>)}
                <button className="master-data-primary" type="submit" disabled={saving || !selectedRequisition || suppliers.length === 0 || currencies.length === 0}>{saving ? "Creating..." : "Create purchase order"}</button>
              </>}
            </form>
          )}
        </section>
      )}

      {activeTab === "invoices" && permissionCodes.has("procurement.supplier_invoices.read") && !loading && (
        <section className="master-data-list">
          <div className="master-data-list-heading"><h2>Supplier Invoices</h2><span>{invoices.length} records</span></div>
          {invoices.length === 0 ? <div className="master-data-state"><strong>No matched invoices yet</strong><span>Invoices are matched against received purchase-order lines.</span></div> : (
            <div className="master-data-table-wrap"><table className="master-data-table"><thead><tr><th>Supplier Invoice</th><th>Purchase Order</th><th>Status</th><th>Created</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td className="master-data-code">{invoice.supplierInvoiceNumber}</td><td>{purchaseOrders.find((order) => order.id === invoice.purchaseOrderId)?.documentNumber ?? invoice.purchaseOrderId}</td><td>{invoice.status}</td><td>{new Date(invoice.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>
          )}
          {formOpen && canCreate && (
            <form className="procurement-form" onSubmit={(event) => void handleInvoiceSubmit(event)}>
              <h3>Match received quantities</h3>
              {!permissionCodes.has("procurement.purchase_orders.read") ? <p role="status">Purchase-order read permission is required.</p> : <>
                <label>Purchase order<select required value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}><option value="">Select received purchase order</option>{invoiceableOrders.map((order) => <option key={order.id} value={order.id}>{order.documentNumber} · {order.supplierCode}</option>)}</select></label>
                <label>Supplier invoice number<input required maxLength={100} value={supplierInvoiceNumber} onChange={(event) => setSupplierInvoiceNumber(event.target.value)} /></label>
                {selectedOrder?.lines.filter((line) => line.receivedQuantity > line.invoicedQuantity).map((line) => <p className="procurement-match-line" key={line.id}>{line.materialCode}: {line.receivedQuantity - line.invoicedQuantity} {line.unitCode} at {line.unitPrice.toFixed(4)} {selectedOrder.currencyCode}</p>)}
                <button className="master-data-primary" type="submit" disabled={saving || !selectedOrder}>{saving ? "Matching..." : "Match invoice"}</button>
              </>}
            </form>
          )}
        </section>
      )}
    </section>
  );
}