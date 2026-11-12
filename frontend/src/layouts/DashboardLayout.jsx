import React, { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import Toast from "../components/Toast";
import { drishtiApi } from "../services/api";
import { useToast } from "../hooks/useToast";
import { listOfflineQueue, syncOfflineQueue } from "../utils/offlineDb";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { toast, notify, clearToast } = useToast();

  const refreshSyncQueue = useCallback(async () => {
    const items = await listOfflineQueue();
    setPendingSyncCount(items.length);
    return items;
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      notify("Device is offline. Captures remain safely queued in IndexedDB.", "error");
      return;
    }
    setSyncing(true);
    try {
      const res = await syncOfflineQueue(drishtiApi);
      await refreshSyncQueue();
      if (res.synced > 0 || res.conflicts > 0) {
        notify(
          `Offline Sync complete: ${res.synced} batch(es) synced${res.conflicts ? `, ${res.conflicts} duplicate skipped` : ""}.`
        );
        window.dispatchEvent(new CustomEvent("drishti-sync-complete"));
      }
    } catch (err) {
      notify(err.message || "Offline sync failed", "error");
    } finally {
      setSyncing(false);
    }
  }, [notify, refreshSyncQueue]);

  useEffect(() => {
    drishtiApi
      .getHealth()
      .then(() => setApiConnected(true))
      .catch(() => setApiConnected(false));
    refreshSyncQueue();

    const handleOnline = () => {
      setIsOnline(true);
      drishtiApi
        .getHealth()
        .then(() => {
          setApiConnected(true);
          triggerSync();
        })
        .catch(() => setApiConnected(false));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setApiConnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshSyncQueue, triggerSync]);

  return (
    <div className="min-h-screen flex bg-[#F7FBEF]">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onOpenMobileNav={() => setMobileOpen(true)}
          apiConnected={apiConnected}
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          syncing={syncing}
          onSyncNow={triggerSync}
          onNotify={notify}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet
            context={{
              notify,
              apiConnected,
              isOnline,
              pendingSyncCount,
              refreshSyncQueue,
              triggerSync,
            }}
          />
        </main>
      </div>
      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
