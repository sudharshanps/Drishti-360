import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { RefreshCw, Save, Settings as SettingsIcon, ShieldAlert } from "lucide-react";
import { drishtiApi } from "../services/api";
import { listOfflineQueue } from "../utils/offlineDb";

const ALL_FIELDS = [
  "batch_number",
  "mfg_date",
  "exp_date",
  "mrp",
  "net_quantity",
  "manufacturer",
  "fssai_license",
];

export default function SettingsPage() {
  const { notify, isOnline, triggerSync } = useOutletContext() || {};
  const [rules, setRules] = useState({
    required_fields: ALL_FIELDS,
    enforce_fssai_format: true,
    enforce_date_order: true,
    enforce_batch_match: true,
  });
  const [health, setHealth] = useState(null);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    drishtiApi.getComplianceRules().then(setRules).catch(() => {});
    drishtiApi.getHealth().then(setHealth).catch(() => {});
    listOfflineQueue().then((q) => setQueueCount(q.length));
  }, []);

  const toggleField = (field) => {
    setRules((prev) => {
      const exists = prev.required_fields.includes(field);
      return {
        ...prev,
        required_fields: exists
          ? prev.required_fields.filter((f) => f !== field)
          : [...prev.required_fields, field],
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const updated = await drishtiApi.updateComplianceRules(rules);
      setRules(updated);
      notify?.("Compliance verification rules saved!");
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#14532D] flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-[#228B22]" />
          Platform Settings, Compliance Rules &amp; Sync Diagnostics
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Configure OCR rule validation thresholds and inspect local offline IndexedDB &amp; backend diagnostics.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4">
          <h2 className="font-extrabold text-sm text-[#14532D]">Configurable Label Compliance Rules</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ALL_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F7FBEF] border border-emerald-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.required_fields.includes(field)}
                  onChange={() => toggleField(field)}
                />
                <span className="font-semibold text-[#14532D]">{field}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-emerald-100 text-xs">
            <label className="flex items-center gap-2 font-semibold text-[#14532D]">
              <input
                type="checkbox"
                checked={rules.enforce_fssai_format}
                onChange={(e) => setRules({ ...rules, enforce_fssai_format: e.target.checked })}
              />
              Validate 14-digit FSSAI License format
            </label>
            <label className="flex items-center gap-2 font-semibold text-[#14532D]">
              <input
                type="checkbox"
                checked={rules.enforce_date_order}
                onChange={(e) => setRules({ ...rules, enforce_date_order: e.target.checked })}
              />
              Flag Expiry Date before Mfg Date or already expired
            </label>
            <label className="flex items-center gap-2 font-semibold text-[#14532D]">
              <input
                type="checkbox"
                checked={rules.enforce_batch_match}
                onChange={(e) => setRules({ ...rules, enforce_batch_match: e.target.checked })}
              />
              Flag Label Batch Code mismatch against CropBatch ID
            </label>
          </div>

          <button type="submit" className="px-5 py-2.5 rounded-xl drishti-gradient text-white text-xs font-bold flex items-center gap-1.5">
            <Save className="w-4 h-4" />
            Save Compliance Rules
          </button>
        </form>

        <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4 text-xs">
          <h2 className="font-extrabold text-sm text-[#14532D] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#228B22]" />
            System Honesty &amp; Offline Sync Diagnostics
          </h2>
          <div className="p-3.5 rounded-xl bg-[#F7FBEF] border border-emerald-100 space-y-1.5">
            <div><span className="font-bold text-[#14532D]">Network Status:</span> {isOnline ? "Online" : "Offline"}</div>
            <div><span className="font-bold text-[#14532D]">IndexedDB Pending Queue:</span> {queueCount} item(s)</div>
            <div><span className="font-bold text-[#14532D]">Database Dialect:</span> {health?.database_dialect || "Checking..."}</div>
            <div><span className="font-bold text-[#14532D]">CV Grading Mode:</span> OpenCV pixel analysis (non-DL heuristic unless ONNX weights exist in <code>backend/models/</code>)</div>
            <div><span className="font-bold text-[#14532D]">OCR Engine:</span> RapidOCR (PaddleOCR PP-OCR ONNXRuntime)</div>
            <div><span className="font-bold text-[#14532D]">Integrity Mechanism:</span> SHA-256 canonical digest verification (tamper-evident, not blockchain)</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await triggerSync?.();
              const q = await listOfflineQueue();
              setQueueCount(q.length);
            }}
            className="px-4 py-2 rounded-xl bg-[#14532D] text-[#D9F99D] font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Trigger Manual IndexedDB Sync
          </button>
        </div>
      </div>
    </div>
  );
}
