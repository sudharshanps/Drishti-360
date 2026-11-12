const DB_NAME = "drishti360_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "pending_sync";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "client_offline_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file for offline storage"));
    reader.readAsDataURL(file);
  });
}

export async function saveOfflineCapture(record) {
  const db = await openDb();
  const id = record.client_offline_id || `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const entry = {
    ...record,
    client_offline_id: id,
    captured_at: record.captured_at || new Date().toISOString(),
    sync_status: "pending",
    sync_message: "Queued locally in IndexedDB awaiting network connectivity",
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOfflineQueue() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeOfflineItem(clientOfflineId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(clientOfflineId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function markOfflineItemStatus(clientOfflineId, syncStatus, syncMessage) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(clientOfflineId);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.sync_status = syncStatus;
        item.sync_message = syncMessage;
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncOfflineQueue(drishtiApi) {
  const items = await listOfflineQueue();
  const pending = items.filter((i) => i.sync_status === "pending" || i.sync_status === "failed");
  if (!pending.length) {
    return { synced: 0, conflicts: 0, failed: 0, results: [] };
  }

  try {
    const res = await drishtiApi.syncOfflineBatch({
      items: pending.map((p) => ({
        client_offline_id: p.client_offline_id,
        crop_type: p.crop_type,
        variety: p.variety,
        quantity_kg: Number(p.quantity_kg),
        origin_location: p.origin_location,
        fpo_name: p.fpo_name || "Kaveri Delta Sustainable FPO",
        captured_at: p.captured_at,
        crop_image_base64: p.crop_image_base64 || null,
        crop_image_filename: p.crop_image_filename || "offline_capture.jpg",
        label_text: p.label_text || null,
        run_full_pipeline: true,
      })),
    });

    let synced = 0;
    let conflicts = 0;
    for (const r of res.results || []) {
      if (r.sync_status === "SYNCED") {
        synced += 1;
        await removeOfflineItem(r.client_offline_id);
      } else if (r.sync_status === "CONFLICT_DUPLICATE_SKIPPED") {
        conflicts += 1;
        await removeOfflineItem(r.client_offline_id);
      }
    }
    return { synced, conflicts, failed: 0, results: res.results || [] };
  } catch (err) {
    for (const p of pending) {
      await markOfflineItemStatus(p.client_offline_id, "failed", err.message || "Sync failed");
    }
    return { synced: 0, conflicts: 0, failed: pending.length, error: err.message };
  }
}
