import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, GitBranch, Lock, PlusCircle } from "lucide-react";
import { drishtiApi } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { formatDateTime } from "../utils/formatters";

const PIPELINE_STAGES = [
  { num: 1, name: "Harvest" },
  { num: 2, name: "Crop Inspection" },
  { num: 3, name: "Quality Grading" },
  { num: 4, name: "Compliance Verification" },
  { num: 5, name: "Price Estimation" },
  { num: 6, name: "Digital Passport" },
  { num: 7, name: "Dispatch" },
  { num: 8, name: "Transaction" },
  { num: 9, name: "Buyer Verification" },
];

export default function TraceabilityLedgerPage() {
  const { t } = useLanguage();
  const { notify } = useOutletContext() || {};

  const [crops, setCrops] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [ledger, setLedger] = useState(null);
  const [eventForm, setEventForm] = useState({
    stage_number: "7",
    actor: "Kaveri Delta Dispatch Coordinator",
    location: "Erode Dispatch Hub, Tamil Nadu",
    supporting_record_id: "",
    notes: "Sealed shipment lot inspected and dispatched to destination mandi.",
  });

  const loadBatchTrace = async (id) => {
    const res = await drishtiApi.getTraceability(id);
    setLedger(res);
  };

  useEffect(() => {
    drishtiApi
      .getCrops()
      .then((list) => {
        setCrops(list);
        if (list.length > 0) {
          setSelectedId(String(list[0].id));
          return loadBatchTrace(list[0].id);
        }
      })
      .catch((err) => notify?.(err.message, "error"));
  }, []);

  const handleSelect = async (id) => {
    setSelectedId(String(id));
    try {
      await loadBatchTrace(id);
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    const stNum = Number(eventForm.stage_number);
    const stObj = PIPELINE_STAGES.find((s) => s.num === stNum);
    try {
      await drishtiApi.addTraceabilityEvent(selectedId, {
        stage_number: stNum,
        stage_name: stObj?.name || `Stage ${stNum}`,
        actor: eventForm.actor,
        location: eventForm.location,
        supporting_record_id: eventForm.supporting_record_id,
        notes: eventForm.notes,
      });
      notify?.(`Stage ${stNum} (${stObj?.name}) recorded with SHA-256 chain link.`);
      await loadBatchTrace(selectedId);
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const completedStages = new Set((ledger?.events || []).map((ev) => ev.stage_number));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#14532D] flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-[#228B22]" />
          {t.nav.traceability}
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          9-stage chronological Farm-to-Market ledger with SHA-256 hash chaining across Harvest, Inspection, Grading, Compliance, Pricing, Passport, Dispatch, Transaction &amp; Buyer Verification.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-emerald-100 shadow-card space-y-2.5">
          <h2 className="font-extrabold text-sm text-[#14532D]">Crop Batches ({crops.length})</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {crops.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                  String(selectedId) === String(c.id)
                    ? "bg-[#ECFCCB] border-[#228B22]"
                    : "bg-[#F7FBEF] border-emerald-100 hover:border-emerald-300"
                }`}
              >
                <div className="flex justify-between font-bold text-[#14532D]">
                  <span>{c.batch_id}</span>
                  <span className="text-[10px] uppercase text-[#228B22]">{c.traceability_events_count} events</span>
                </div>
                <div className="text-gray-600 mt-0.5">
                  {c.crop_type} ({c.variety}) · {c.quantity_kg} kg
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-5">
          {ledger ? (
            <>
              <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div>
                    <div className="text-xs font-bold text-[#228B22]">{ledger.batch.batch_id} · {ledger.batch.fpo_name}</div>
                    <h2 className="text-lg font-extrabold text-[#14532D]">
                      {ledger.batch.crop_type} ({ledger.batch.variety}) — {ledger.batch.origin_location}
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-[#14532D]">
                    <Lock className="w-3.5 h-3.5 text-[#228B22]" />
                    {ledger.chain_integrity}
                  </span>
                </div>

                {/* 9-Stage Journey Stepper */}
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                  {PIPELINE_STAGES.map((st) => {
                    const done = completedStages.has(st.num);
                    return (
                      <div
                        key={st.num}
                        className={`p-2 rounded-xl border text-center text-[10px] font-bold ${
                          done
                            ? "bg-[#ECFCCB] border-[#228B22] text-[#14532D]"
                            : "bg-gray-50 border-gray-200 text-gray-400"
                        }`}
                      >
                        <div className="text-xs font-extrabold">{st.num}</div>
                        <div className="leading-tight mt-0.5">{st.name}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  {ledger.events.map((ev) => (
                    <div key={ev.event_id} className="p-3.5 rounded-xl bg-[#F7FBEF] border border-emerald-100 flex gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#228B22] mt-0.5 shrink-0" />
                      <div className="text-xs flex-1 space-y-1">
                        <div className="flex flex-wrap justify-between gap-2 font-bold text-[#14532D]">
                          <span>Stage {ev.stage_number}: {ev.stage_name}</span>
                          <span className="text-[10px] text-gray-500">{formatDateTime(ev.recorded_at)}</span>
                        </div>
                        <div className="text-gray-700">{ev.notes}</div>
                        <div className="text-[10px] text-gray-500">
                          Actor: {ev.actor} · {ev.location} · Event ID: {ev.event_id}
                          {ev.supporting_record_id ? ` · Ref: ${ev.supporting_record_id}` : ""}
                        </div>
                        {ev.event_hash && (
                          <div className="font-mono text-[10px] text-gray-400 break-all">
                            SHA-256: {ev.event_hash} (Prev: {(ev.previous_hash || "").slice(0, 14)}...)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Log Dispatch / Transaction / Buyer Verification */}
              <form onSubmit={handleAddEvent} className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-3">
                <h3 className="font-extrabold text-sm text-[#14532D] flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-[#228B22]" />
                  Record Downstream Traceability Event (Dispatch / Transaction / Buyer Verification)
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <select
                    value={eventForm.stage_number}
                    onChange={(e) => setEventForm({ ...eventForm, stage_number: e.target.value })}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                  >
                    <option value="7">Stage 7: Dispatch</option>
                    <option value="8">Stage 8: Transaction</option>
                    <option value="9">Stage 9: Buyer Verification</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Responsible Actor"
                    value={eventForm.actor}
                    onChange={(e) => setEventForm({ ...eventForm, actor: e.target.value })}
                    className="px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Location"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    className="px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                  />
                </div>
                <textarea
                  rows={2}
                  required
                  value={eventForm.notes}
                  onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                />
                <button type="submit" className="px-5 py-2.5 rounded-xl drishti-gradient text-white text-xs font-bold">
                  Append Hash-Chained Event
                </button>
              </form>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-xs text-gray-500">Select a batch to view traceability events.</div>
          )}
        </div>
      </div>
    </div>
  );
}
