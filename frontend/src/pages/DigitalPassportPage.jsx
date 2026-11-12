import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { AlertTriangle, Download, ExternalLink, Lock, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { drishtiApi, resolveBackendAsset } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { formatDateTime, formatINR } from "../utils/formatters";
import { ComplianceBadge, DemoBadge, GradeBadge } from "../components/StatusBadge";

export default function DigitalPassportPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notify } = useOutletContext() || {};

  const [crops, setCrops] = useState([]);
  const [passports, setPassports] = useState([]);
  const [batchId, setBatchId] = useState(searchParams.get("batchId") || "");
  const [active, setActive] = useState(null);
  const [generating, setGenerating] = useState(false);

  const loadData = async (preferredBatchId = batchId) => {
    try {
      const [cList, pList] = await Promise.all([
        drishtiApi.getCrops(),
        drishtiApi.getPassports(),
      ]);
      setCrops(cList);
      setPassports(pList);

      const paramId = preferredBatchId || searchParams.get("batchId");
      if (!batchId && cList.length > 0) {
        setBatchId(paramId || String(cList[0].id));
      }
      if (pList.length > 0 && !active) {
        const matched = paramId ? pList.find((p) => String(p.batch_id) === String(paramId)) : null;
        setActive(matched || pList[0]);
      }
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async () => {
    if (!batchId) {
      notify?.("Please select an inspected crop batch.", "error");
      return;
    }
    setGenerating(true);
    try {
      const res = await drishtiApi.generatePassport({ batch_id: Number(batchId) });
      setActive(res);
      notify?.(`Digital Quality Passport ${res.passport_id} ready!`);
      await loadData(batchId);
    } catch (err) {
      notify?.(err.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Flagship Header */}
      <div className="rounded-3xl p-6 drishti-gradient text-white shadow-glow flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A3E635] text-[#14532D] text-[11px] font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Flagship Innovation #2 · Digital Quality Passport
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
            <QrCode className="w-7 h-7 text-[#D9F99D]" />
            {t.nav.digitalPassport}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl">
            Binds crop inspection, grade, label compliance, and fair price reference into a verifiable digital certificate with downloadable PDF and scannable QR code.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 bg-white/10 p-3 rounded-2xl border border-white/20">
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white text-[#14532D] text-xs font-bold min-w-[230px]"
          >
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.batch_id} — {c.crop_type} (Grade {c.grade || "Pending"})
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-xl bg-[#A3E635] text-[#14532D] text-xs font-extrabold hover:bg-[#D9F99D] transition"
          >
            {generating ? "Generating..." : t.actions.generatePassport}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          {active ? (
            <div className="bg-white rounded-3xl border-2 border-[#228B22]/30 shadow-card overflow-hidden">
              <div className="bg-[#14532D] px-6 py-5 text-white flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-[#A3E635] uppercase tracking-widest">
                    Digital Quality Passport
                  </div>
                  <h2 className="text-xl font-extrabold">{active.passport_id}</h2>
                  <div className="text-xs text-[#D9F99D]">Batch ID: {active.batch_code}</div>
                </div>
                <div className="flex items-center gap-2">
                  <DemoBadge isDemo={active.is_demo} label="Demo Certified" />
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#A3E635] text-[#14532D] text-xs font-extrabold">
                    <ShieldCheck className="w-4 h-4" />
                    {active.verification_status}
                  </span>
                </div>
              </div>

              <div className="p-6 grid md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-8 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <GradeBadge grade={active.grade} />
                    <ComplianceBadge status={active.compliance_status} />
                    <span className="px-3 py-0.5 rounded-full bg-[#F7FBEF] border border-emerald-200 text-xs font-bold text-[#14532D]">
                      Score: {active.quality_score}/100
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                      <div className="text-gray-500">Crop &amp; Variety</div>
                      <div className="font-extrabold text-[#14532D] text-sm mt-0.5">
                        {active.crop_name} ({active.variety})
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                      <div className="text-gray-500">Farmer / Origin &amp; Qty</div>
                      <div className="font-bold text-[#14532D] mt-0.5">
                        {active.farmer_name} · {active.origin_location} ({active.quantity_kg} kg)
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#ECFCCB] border border-[#A3E635] sm:col-span-2">
                      <div className="text-[#14532D]/70 font-semibold">Grade-Linked Fair Price Reference</div>
                      <div className="font-extrabold text-[#14532D] text-sm mt-0.5">
                        {formatINR(active.indicative_price_per_quintal)} / quintal{" "}
                        <span className="text-xs font-semibold">
                          (Estimated Lot Value: {formatINR(active.estimated_total_value)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-emerald-100 text-xs text-gray-700">
                    <span className="font-bold text-[#14532D]">Quality Observations: </span>
                    {active.quality_observations}
                  </div>

                  {/* Cryptographic SHA-256 Integrity Panel */}
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      active.integrity?.is_intact === false
                        ? "bg-rose-50 border-rose-300 text-rose-900"
                        : "bg-emerald-50/70 border-emerald-200 text-[#14532D]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold">
                      <span className="flex items-center gap-1.5">
                        {active.integrity?.is_intact === false ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-[#228B22]" />
                        )}
                        SHA-256 Integrity Check: {active.integrity?.integrity_status || "VERIFIED_INTACT"}
                      </span>
                      <span className="text-[11px] font-semibold">
                        QR Scans: {active.verification_count || 0}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] break-all opacity-90">
                      Passport Hash: {active.passport_hash || "N/A"} | Inspection Hash: {active.inspection_hash || "N/A"}
                    </div>
                    {active.integrity?.mismatches?.length > 0 && (
                      <div className="font-bold text-rose-700">
                        Mismatch Flagged: {active.integrity.mismatches.join(", ")} (Linked record modified after issuance!)
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600">
                      Tamper-evident canonical SHA-256 digest verification (not a blockchain ledger).
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500">
                    Inspected: {formatDateTime(active.inspection_timestamp)} · Issued: {formatDateTime(active.issued_at)}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <a
                      href={drishtiApi.getPassportPdfUrl(active.passport_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 rounded-xl drishti-gradient text-white text-xs font-bold shadow-sm hover:opacity-95 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {t.actions.downloadPdf}
                    </a>
                    <button
                      onClick={() => navigate(`/verify/${active.passport_id}`)}
                      className="px-4 py-2.5 rounded-xl bg-[#ECFCCB] text-[#14532D] border border-[#A3E635] text-xs font-bold hover:bg-[#D9F99D] flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.actions.openVerifyPage}
                    </button>
                  </div>
                </div>

                {/* Live Scannable QR Code */}
                <div className="md:col-span-4 flex flex-col items-center text-center p-4 rounded-2xl bg-[#F7FBEF] border border-[#D9F99D]">
                  <img
                    src={resolveBackendAsset(active.qr_image_url)}
                    alt={`QR Code for ${active.passport_id}`}
                    className="w-44 h-44 rounded-xl bg-white p-2 border border-emerald-200 shadow-sm"
                  />
                  <div className="mt-3 text-xs font-extrabold text-[#14532D]">Scan to Verify Batch</div>
                  <div className="text-[10px] text-gray-500 break-all mt-1">{active.qr_verification_url}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-10 text-center text-sm text-gray-500 border border-emerald-100">
              Select a batch and generate a Digital Quality Passport.
            </div>
          )}
        </div>

        {/* Issued Passports */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-emerald-100 shadow-card space-y-2.5">
          <h3 className="font-extrabold text-sm text-[#14532D]">Issued Passports ({passports.length})</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {passports.map((p) => (
              <button
                key={p.passport_id}
                onClick={async () => {
                  const detail = await drishtiApi.getPassportById(p.passport_id);
                  setActive(detail);
                }}
                className={`w-full text-left p-3.5 rounded-2xl border flex items-center justify-between text-xs transition ${
                  active?.passport_id === p.passport_id
                    ? "bg-[#ECFCCB]/70 border-[#228B22]"
                    : "bg-[#F7FBEF] border-emerald-100 hover:border-[#228B22]"
                }`}
              >
                <div>
                  <div className="font-extrabold text-[#14532D]">{p.passport_id}</div>
                  <div className="text-[#228B22] font-semibold">
                    {p.crop_name} ({p.variety})
                  </div>
                  <div className="text-[10px] text-gray-500">{p.batch_code}</div>
                </div>
                <GradeBadge grade={p.grade} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
