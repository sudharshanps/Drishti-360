import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AlertTriangle, Clock, FileCheck2, Settings, UploadCloud } from "lucide-react";
import { drishtiApi, resolveBackendAsset } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { ComplianceBadge } from "../components/StatusBadge";

export default function LabelCompliancePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { notify } = useOutletContext() || {};

  const [crops, setCrops] = useState([]);
  const [checks, setChecks] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [labelFile, setLabelFile] = useState(null);
  const [labelPreview, setLabelPreview] = useState("");
  const [sampleText, setSampleText] = useState(
    "Batch No: DR360-BCH-2026-001, Mfd: 10/11/2026, Exp: 10/05/2027, MRP: INR 350, Net Wt: 5 kg, FSSAI Lic No: 12426008001924, Mfg By: Kaveri Delta Sustainable FPO"
  );
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const loadData = async () => {
    try {
      const [cList, cmpList] = await Promise.all([
        drishtiApi.getCrops(),
        drishtiApi.getComplianceChecks(),
      ]);
      setCrops(cList);
      setChecks(cmpList);
      if (!batchId && cList.length > 0) setBatchId(String(cList[0].id));
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setRunning(true);
    try {
      let res;
      if (labelFile) {
        const fd = new FormData();
        fd.append("batch_id", batchId);
        fd.append("sample_text", sampleText);
        fd.append("file", labelFile);
        res = await drishtiApi.analyzeComplianceUpload(fd);
      } else {
        res = await drishtiApi.analyzeCompliance({
          batch_id: Number(batchId),
          image_filename: "label_text.png",
          sample_text: sampleText,
        });
      }
      setResult(res);
      notify?.(`Compliance check ${res.compliance_id}: ${res.status} (${res.inference_time_ms} ms)`);
      await loadData();
    } catch (err) {
      notify?.(err.message, "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14532D] flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-[#228B22]" />
            {t.nav.labelCompliance}
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            RapidOCR (PaddleOCR ONNX) packaging extraction &amp; rule-based declaration verification with inconsistency alerts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/app/settings")}
          className="px-3.5 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-[#14532D] flex items-center gap-1.5 hover:bg-[#ECFCCB]"
        >
          <Settings className="w-3.5 h-3.5 text-[#228B22]" />
          Configure Compliance Rules
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#14532D] mb-1">Crop Batch</label>
            <select
              value={batchId}
              onChange={(e) => {
                const selected = crops.find((c) => String(c.id) === e.target.value);
                setBatchId(e.target.value);
                if (selected) {
                  setSampleText(
                    `Batch No: ${selected.batch_id}, Mfd: 10/11/2026, Exp: 10/05/2027, MRP: INR 420, Net Wt: ${selected.quantity_kg} kg, FSSAI Lic No: 12426008001924, Mfg By: ${selected.fpo_name}`
                  );
                }
              }}
              className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            >
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.batch_id} — {c.crop_type}
                </option>
              ))}
            </select>
          </div>

          <label className="block border-2 border-dashed border-emerald-300 rounded-2xl p-4 bg-[#F7FBEF] hover:bg-[#ECFCCB]/50 cursor-pointer text-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setLabelFile(f);
                  setLabelPreview(URL.createObjectURL(f));
                }
              }}
            />
            {labelPreview ? (
              <div className="flex items-center gap-3 text-left">
                <img src={labelPreview} alt="Label preview" className="w-16 h-16 rounded-xl object-cover border border-emerald-200" />
                <div className="text-xs">
                  <div className="font-bold text-[#14532D]">{labelFile?.name}</div>
                  <div className="text-gray-600">RapidOCR PP-OCR ONNX will extract label text automatically</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-xs text-[#14532D]">
                <UploadCloud className="w-6 h-6 text-[#228B22]" />
                <span className="font-bold">Upload Packaging Label Photo (PNG / JPG) for RapidOCR Extraction</span>
                <span className="text-[11px] text-gray-500">Or use fallback label text below to test rule engine directly</span>
              </div>
            )}
          </label>

          <textarea
            rows={3}
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder="Fallback label text..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
          />
          <button
            type="submit"
            disabled={running}
            className="w-full py-2.5 rounded-xl drishti-gradient text-white text-xs font-bold disabled:opacity-60"
          >
            {running ? "Running RapidOCR & Rule Engine..." : t.actions.verifyLabel}
          </button>
        </form>

        <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-3">
          <h2 className="font-extrabold text-sm text-[#14532D]">Compliance Verification Result</h2>
          {result ? (
            <div className="p-4 rounded-xl bg-[#F7FBEF] border border-emerald-100 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#14532D]">{result.compliance_id}</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-[11px] font-bold text-[#14532D]">
                    <Clock className="w-3 h-3 text-[#228B22]" />
                    {result.inference_time_ms} ms
                  </span>
                  <ComplianceBadge status={result.status} />
                </div>
              </div>

              {result.image_url && (
                <img
                  src={resolveBackendAsset(result.image_url)}
                  alt="Packaging evidence"
                  className="max-h-40 rounded-xl border border-emerald-200 object-contain bg-white p-1"
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result.extracted_fields || {})
                  .filter(([k]) => k !== "ocr_lines_count")
                  .map(([k, v]) => (
                    <div key={k} className="p-2 rounded-lg bg-white border border-emerald-100">
                      <div className="text-[10px] uppercase text-gray-500">{k.replace("_", " ")}</div>
                      <div className={`font-bold ${v ? "text-[#14532D]" : "text-rose-600"}`}>{v || "Missing"}</div>
                    </div>
                  ))}
              </div>

              {result.inconsistencies?.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Inconsistency Alerts
                  </div>
                  {result.inconsistencies.map((inc) => (
                    <div key={inc}>• {inc}</div>
                  ))}
                </div>
              )}

              <div className="text-gray-700">{result.notes}</div>
              <div className="font-mono text-[10px] text-gray-500">
                Engine: {result.ocr_engine} · SHA-256: {result.record_hash}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">Upload a label photo or run verification to inspect extracted declarations.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card">
        <h2 className="font-extrabold text-sm text-[#14532D] mb-3">Compliance History</h2>
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.compliance_id} className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-[#14532D]">{c.compliance_id}</span> · {c.batch_code} ·{" "}
                <span className="text-gray-600">{c.ocr_engine}</span>
                <div className="text-[11px] text-gray-600 mt-0.5">{c.notes}</div>
              </div>
              <ComplianceBadge status={c.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
