import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import {
  listStorageLocations,
  type StorageLocation,
} from "../api/master-data-api";
import {
  type PurchaseOrder,
  listPurchaseOrders,
} from "../api/procurement-api";
import {
  createGoodsReceipt,
  listStockBalances,
  listStockMovements,
  type StockBalance,
  type StockMovement,
} from "../api/inventory-api";
import "./InventoryWorkspace.css";

type InventoryTab = "stock" | "receipts";

const getErrorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : "The request could not be completed.";

export type InventoryWorkspaceProps = {
  token: string;
  permissionCodes: ReadonlySet<string>;
};

export function InventoryWorkspace({ token, permissionCodes }: InventoryWorkspaceProps) {
  const tabs = [
    { id: "stock" as const, label: "Stock", permission: "inventory.stock.read" },
    { id: "receipts" as const, label: "Goods Receipts", permission: "inventory.goods_receipts.create" },
  ].filter((tab) => permissionCodes.has(tab.permission));
  const [activeTab, setActiveTab] = useState<InventoryTab>(tabs[0]?.id ?? "stock");
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [receiptLines, setReceiptLines] = useState<Record<string, { quantity: string; storageLocationId: string }>>({});
  const [receiptNumber, setReceiptNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async (): Promise<void> => {
      try {
        const [stock, history, purchaseOrders, storageLocations] = await Promise.all([
          permissionCodes.has("inventory.stock.read") ? listStockBalances(token) : Promise.resolve([]),
          permissionCodes.has("inventory.stock.read") ? listStockMovements(token) : Promise.resolve([]),
          permissionCodes.has("procurement.purchase_orders.read") ? listPurchaseOrders(token) : Promise.resolve([]),
          permissionCodes.has("core.storage_locations.read") ? listStorageLocations(token) : Promise.resolve([]),
        ]);
        if (active) {
          setBalances(stock);
          setMovements(history);
          setOrders(purchaseOrders);
          setLocations(storageLocations.filter((location) => location.status === "ACTIVE"));
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

  const eligibleOrders = orders.filter((order) =>
    order.status === "OPEN" || order.status === "PARTIALLY_RECEIVED",
  );
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const hasReceiptDependencies =
    permissionCodes.has("procurement.purchase_orders.read") &&
    permissionCodes.has("core.storage_locations.read");

  const selectOrder = (orderId: string): void => {
    setSelectedOrderId(orderId);
    const order = orders.find((candidate) => candidate.id === orderId);
    setReceiptLines(Object.fromEntries((order?.lines ?? []).map((line) => [line.id, {
      quantity: "",
      storageLocationId: "",
    }])));
  };

  const updateReceiptLine = (
    lineId: string,
    update: Partial<{ quantity: string; storageLocationId: string }>,
  ): void => {
    setReceiptLines((current) => {
      const line = current[lineId] ?? { quantity: "", storageLocationId: "" };
      return {
        ...current,
        [lineId]: { ...line, ...update },
      };
    });
  };

  const handleReceipt = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const lines = selectedOrder.lines
        .filter((line) => Number(receiptLines[line.id]?.quantity) > 0)
        .map((line) => ({
          purchaseOrderLineId: line.id,
          quantity: Number(receiptLines[line.id]?.quantity),
          storageLocationId: receiptLines[line.id]?.storageLocationId ?? "",
        }));
      if (lines.length === 0) throw new Error("Enter a quantity for at least one order line.");
      const receipt = await createGoodsReceipt(token, selectedOrder.id, { lines });
      setSuccess(`Goods receipt ${receipt.documentNumber} posted.`);
      setReceiptNumber(receipt.documentNumber);
      setFormOpen(false);
      setSelectedOrderId("");
      setReceiptLines({});
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  if (tabs.length === 0) {
    return <section className="master-data-access-empty"><h2>Inventory</h2><p>Your account does not have inventory permissions.</p></section>;
  }

  return (
    <section className="master-data-page inventory-page">
      <header className="master-data-header">
        <div><div className="master-data-eyebrow">SUPPLY CHAIN</div><h1>Inventory</h1></div>
        {activeTab === "receipts" && permissionCodes.has("inventory.goods_receipts.create") && (
          <button type="button" className="master-data-primary" onClick={() => { setFormOpen((open) => !open); setError(null); setSuccess(null); }}>
            {formOpen ? "Close form" : "Record goods receipt"}
          </button>
        )}
      </header>

      <div className="master-data-toolbar">
        <div className="master-data-tabs" role="tablist" aria-label="Inventory views">
          {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "selected" : ""} onClick={() => { setActiveTab(tab.id); setFormOpen(false); setError(null); setSuccess(null); }}>{tab.label}</button>)}
        </div>
        <button type="button" className="master-data-refresh" aria-label="Refresh inventory" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>↻</button>
      </div>

      {(error || success) && <div className={error ? "master-data-notice error" : "master-data-notice success"} role={error ? "alert" : "status"}>{error ?? success}</div>}
      {loading && <div className="master-data-state" role="status">Loading inventory...</div>}

      {activeTab === "stock" && permissionCodes.has("inventory.stock.read") && !loading && (
        <>
          <section className="master-data-list">
            <div className="master-data-list-heading"><h2>Stock by Location</h2><span>{balances.length} balances</span></div>
            {balances.length === 0 ? <div className="master-data-state"><strong>No stock recorded</strong><span>Post a goods receipt to establish on-hand inventory.</span></div> : (
              <div className="master-data-table-wrap"><table className="master-data-table"><thead><tr><th>Plant</th><th>Warehouse</th><th>Location</th><th>Material</th><th>On Hand</th><th>Unit</th></tr></thead><tbody>{balances.map((balance) => <tr key={`${balance.storageLocationId}:${balance.materialId}`}><td>{balance.plantId}</td><td>{balance.warehouseCode}</td><td>{balance.storageLocationCode}</td><td>{balance.materialCode} · {balance.materialName}</td><td>{balance.quantity}</td><td>{balance.unitCode}</td></tr>)}</tbody></table></div>
            )}
          </section>
          <section className="master-data-list inventory-movement-list">
            <div className="master-data-list-heading"><h2>Recent Movements</h2><span>Last {movements.length}</span></div>
            {movements.length === 0 ? <div className="master-data-state">No inventory movements.</div> : (
              <div className="master-data-table-wrap"><table className="master-data-table"><thead><tr><th>Occurred</th><th>Material</th><th>Location ID</th><th>Quantity Change</th><th>Receipt Line</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.occurredAt).toLocaleString()}</td><td>{movement.materialId}</td><td>{movement.storageLocationId}</td><td>+{movement.quantityDelta}</td><td>{movement.goodsReceiptLineId}</td></tr>)}</tbody></table></div>
            )}
          </section>
        </>
      )}

      {activeTab === "receipts" && formOpen && permissionCodes.has("inventory.goods_receipts.create") && (
        <form className="inventory-receipt-form" onSubmit={(event) => void handleReceipt(event)}>
          <h2>Post Goods Receipt</h2>
          {!hasReceiptDependencies ? <p role="status">Purchase-order and storage-location read permissions are required for receiving.</p> : (
            <>
              <label>Purchase order<select value={selectedOrderId} required onChange={(event) => selectOrder(event.target.value)}><option value="">Select open purchase order</option>{eligibleOrders.map((order) => <option key={order.id} value={order.id}>{order.documentNumber} · {order.supplierCode}</option>)}</select></label>
              {selectedOrder?.lines.map((line) => {
                const outstanding = line.quantity - line.receivedQuantity;
                if (outstanding <= 0) return null;
                const value = receiptLines[line.id] ?? { quantity: "", storageLocationId: "" };
                return <div className="inventory-receipt-line" key={line.id}>
                  <div className="inventory-receipt-material"><strong>{line.materialCode} · {line.materialName}</strong><span>{outstanding} {line.unitCode} outstanding</span></div>
                  <label>Receive<input type="number" min="0" max={outstanding} step="0.0001" value={value.quantity} onChange={(event) => updateReceiptLine(line.id, { quantity: event.target.value })} disabled={saving} /></label>
                  <label>Storage location<select value={value.storageLocationId} onChange={(event) => updateReceiptLine(line.id, { storageLocationId: event.target.value })} disabled={saving || locations.length === 0}><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</select></label>
                </div>;
              })}
              {eligibleOrders.length === 0 && <p className="master-data-form-hint">No open purchase orders are available.</p>}
              {selectedOrder && locations.length === 0 && <p className="master-data-form-hint">Create an active storage location before receiving stock.</p>}
              <button className="master-data-primary" type="submit" disabled={saving || !selectedOrder || locations.length === 0}>{saving ? "Posting..." : "Post receipt"}</button>
            </>
          )}
        </form>
      )}

      {activeTab === "receipts" && !formOpen && !loading && permissionCodes.has("inventory.stock.read") && (
        <section className="master-data-list">
          <div className="master-data-list-heading"><h2>On-hand Balances</h2><span>{balances.length} balances</span></div>
          {balances.length === 0 ? <div className="master-data-state"><strong>No stock recorded</strong><span>Receipts update inventory balances and movements.</span></div> : (
            <div className="master-data-table-wrap"><table className="master-data-table"><thead><tr><th>Material</th><th>Location</th><th>On Hand</th><th>Unit</th></tr></thead><tbody>{balances.map((balance) => <tr key={`${balance.storageLocationId}:${balance.materialId}`}><td>{balance.materialCode} · {balance.materialName}</td><td>{balance.warehouseCode} / {balance.storageLocationCode}</td><td>{balance.quantity}</td><td>{balance.unitCode}</td></tr>)}</tbody></table></div>
          )}
        </section>
      )}
      {receiptNumber && <span className="inventory-last-receipt">Last posted receipt: {receiptNumber}</span>}
    </section>
  );
}