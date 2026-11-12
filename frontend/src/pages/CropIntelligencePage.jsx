import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  PlusCircle,
  RefreshCw,
  ScanEye,
  UploadCloud,
  UserCheck,
  WifiOff,
} from "lucide-react";
import { drishtiApi, resolveBackendAsset } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { GradeBadge } from "../components/StatusBadge";
import { fileToBase64, listOfflineQueue, saveOfflineCapture } from "../utils/offlineDb";

export default function CropIntelligencePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { notify, isOnline, refreshSyncQueue, triggerSync } = useOutletContext() || {};

  const [tab, setTab] = useState("inspect"); // 'inspect' | 'fusion' | 'calibration'
  const [crops, setCrops] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [calStats, setCalStats] = useState(null);
  const [offlineQueue, setOfflineQueue] = useState([]);

  const [newBatch, setNewBatch] = useState({
    crop_type: "Turmeric",
    variety: "Erode Salem",
    quantity_kg: "600",
    origin_location: "Erode, Tamil Nadu",
    fpo_name: "Kaveri Delta Sustainable FPO",
  });

  const [inspectForm, setInspectForm] = useState({
    batch_id: "",
    crop_type: "Turmeric",
    variety: "Erode Salem",
    location: "Erode, Tamil Nadu",
  });
  const [cropFile, setCropFile] = useState(null);
  const [cropPreview, setCropPreview] = useState("");
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  // Multi-Modal Fusion form
  const [fusionForm, setFusionForm] = useState({
    crop_type: "Mango",
    variety: "Alphonso",
    quantity_kg: "800",
    origin_location: "Ratnagiri, Maharashtra",
    mandi_location: "Vashi APMC, Mumbai",
    sample_label_text: "Batch No: DR360-FUSION, Mfd: 11/11/2026, Exp: 25/11/2026, MRP: Rs 950, Net Wt: 10 kg, FSSAI Lic No: 12426008001924, Mfg By: Sahyadri Mango FPO",
  });
  const [fusionCropFile, setFusionCropFile] = useState(null);
  const [fusionLabelFile, setFusionLabelFile] = useState(null);
  const [fusionResult, setFusionResult] = useState(null);
  const [runningFusion, setRunningFusion] = useState(false);

  // Human-in-the-loop review form
  const [reviewForm, setReviewForm] = useState({
    inspection_id: "",
    corrected_grade: "A",
    correction_reason: "Confirmed under shed daylight inspection",
    reviewer_name: "Dr. Karthik Subramanian (QCI Grader)",
    reviewer_notes: "Verified sample uniformity and moisture consistency.",
  });

  const loadData = async () => {
    const q = await listOfflineQueue();
    setOfflineQueue(q);
    try {
      const [cropList, inspList, cStats] = await Promise.all([
        drishtiApi.getCrops(),
        drishtiApi.getInspections(),
        drishtiApi.getCalibrationStats(),
      ]);
      setCrops(cropList);
      setInspections(inspList);
      setCalStats(cStats);
      if (!inspectForm.batch_id && cropList.length > 0) {
        setInspectForm((prev) => ({
          ...prev,
          batch_id: String(cropList[0].id),
          crop_type: cropList[0].crop_type,
          variety: cropList[0].variety,
          location: cropList[0].origin_location,
        }));
      }
      if (!reviewForm.inspection_id && inspList.length > 0) {
        setReviewForm((prev) => ({
          ...prev,
          inspection_id: inspList[0].inspection_id,
          corrected_grade: inspList[0].final_grade || inspList[0].estimated_grade,
        }));
      }
    } catch (err) {
      if (isOnline) notify?.(err.message, "error");
    }
  };

  useEffect(() => {
    loadData();
    const onSync = () => loadData();
    window.addEventListener("drishti-sync-complete", onSync);
    return () => window.removeEventListener("drishti-sync-complete", onSync);
  }, []);

  const handleFileChange = (file) => {
    if (!file) return;
    setCropFile(file);
    setCropPreview(URL.createObjectURL(file));
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!isOnline || simulateOffline) {
      const b64 = cropFile ? await fileToBase64(cropFile) : null;
      const queued = await saveOfflineCapture({
        ...newBatch,
        crop_image_base64: b64,
        crop_image_filename: cropFile?.name || "offline_capture.jpg",
      });
      await refreshSyncQueue?.();
      setOfflineQueue(await listOfflineQueue());
      notify?.(`Saved offline capture ${queued.client_offline_id} in IndexedDB!`);
      return;
    }

    try {
      const created = await drishtiApi.createCropBatch({
        ...newBatch,
        quantity_kg: Number(newBatch.quantity_kg),
      });
      notify?.(`Created batch ${created.batch_id}`);
      await loadData();
      setInspectForm({
        batch_id: String(created.id),
        crop_type: created.crop_type,
        variety: created.variety,
        location: created.origin_location,
      });
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!isOnline || simulateOffline) {
      const b64 = cropFile ? await fileToBase64(cropFile) : null;
      const queued = await saveOfflineCapture({
        crop_type: inspectForm.crop_type,
        variety: inspectForm.variety,
        quantity_kg: Number(newBatch.quantity_kg) || 500,
        origin_location: inspectForm.location,
        fpo_name: newBatch.fpo_name,
        crop_image_base64: b64,
        crop_image_filename: cropFile?.name || "offline_crop.jpg",
      });
      await refreshSyncQueue?.();
      setOfflineQueue(await listOfflineQueue());
      notify?.(`Offline capture ${queued.client_offline_id} queued in IndexedDB!`);
      return;
    }

    setAnalyzing(true);
    try {
      let res;
      if (cropFile) {
        const fd = new FormData();
        fd.append("batch_id", inspectForm.batch_id);
        fd.append("crop_type", inspectForm.crop_type);
        fd.append("variety", inspectForm.variety);
        fd.append("location", inspectForm.location);
        fd.append("file", cropFile);
        res = await drishtiApi.analyzeInspectionUpload(fd);
      } else {
        res = await drishtiApi.analyzeInspection({
          ...inspectForm,
          batch_id: Number(inspectForm.batch_id),
          image_filename: "sample_crop.jpg",
        });
      }
      setResult(res);
      notify?.(
        `Inspection ${res.inspection_id}: Grade ${res.final_grade} (${res.quality_score}/100) in ${res.inference_time_ms} ms`
      );
      await loadData();
    } catch (err) {
      notify?.(err.message, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunFusion = async (e) => {
    e.preventDefault();
    setRunningFusion(true);
    try {
      const fd = new FormData();
      Object.entries(fusionForm).forEach(([k, v]) => fd.append(k, v));
      fd.append("generate_passport_now", "true");
      if (fusionCropFile) fd.append("crop_image", fusionCropFile);
      if (fusionLabelFile) fd.append("label_image", fusionLabelFile);
      const res = await drishtiApi.runMultimodalFusion(fd);
      setFusionResult(res);
      notify?.(`Multi-Modal Fusion completed for ${res.batch.batch_id} in ${res.total_pipeline_ms} ms!`);
      await loadData();
    } catch (err) {
      notify?.(err.message, "error");
    } finally {
      setRunningFusion(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await drishtiApi.submitInspectorReview(reviewForm.inspection_id, {
        corrected_grade: reviewForm.corrected_grade,
        correction_reason: reviewForm.correction_reason,
        reviewer_name: reviewForm.reviewer_name,
        reviewer_notes: reviewForm.reviewer_notes,
      });
      notify?.(`Inspector review ${res.feedback_id} saved (Grade ${res.corrected_grade}).`);
      await loadData();
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const activeBatch = crops.find((c) => String(c.id) === String(result?.batch_id || inspectForm.batch_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14532D] flex items-center gap-2">
            <ScanEye className="w-6 h-6 text-[#228B22]" />
            {t.nav.cropIntelligence}
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            OpenCV Computer Vision grading, Multi-Modal Intelligence Fusion, Offline-First IndexedDB capture, and Human-in-the-Loop calibration.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSimulateOffline(!simulateOffline)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              simulateOffline
                ? "bg-amber-100 border-amber-300 text-amber-900"
                : "bg-white border-emerald-200 text-[#14532D]"
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            {simulateOffline ? "Offline Simulation: ON" : "Simulate Offline Capture"}
          </button>
          <div className="inline-flex rounded-xl bg-white border border-emerald-200 p-1 text-xs font-bold">
            {[
              { id: "inspect", label: "Visual Inspection" },
              { id: "fusion", label: "Multi-Modal Fusion" },
              { id: "calibration", label: "Inspector Calibration" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  tab === item.id ? "bg-[#14532D] text-[#D9F99D]" : "text-[#14532D] hover:bg-[#F7FBEF]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: VISUAL CROP INSPECTION + OFFLINE CAPTURE */}
      {tab === "inspect" && (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <form onSubmit={handleCreateBatch} className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-3.5">
              <h2 className="font-extrabold text-sm text-[#14532D] flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#228B22]" />
                1. Register Crop Batch {simulateOffline || !isOnline ? "(Offline IndexedDB Queue)" : ""}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Crop Type"
                  value={newBatch.crop_type}
                  onChange={(e) => setNewBatch({ ...newBatch, crop_type: e.target.value })}
                  className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                />
                <input
                  type="text"
                  required
                  placeholder="Variety"
                  value={newBatch.variety}
                  onChange={(e) => setNewBatch({ ...newBatch, variety: e.target.value })}
                  className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                />
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Quantity (kg)"
                  value={newBatch.quantity_kg}
                  onChange={(e) => setNewBatch({ ...newBatch, quantity_kg: e.target.value })}
                  className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                />
                <input
                  type="text"
                  required
                  placeholder="Origin Location"
                  value={newBatch.origin_location}
                  onChange={(e) => setNewBatch({ ...newBatch, origin_location: e.target.value })}
                  className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
                />
              </div>
              <input
                type="text"
                placeholder="FPO Name"
                value={newBatch.fpo_name}
                onChange={(e) => setNewBatch({ ...newBatch, fpo_name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#14532D] text-white text-xs font-bold hover:bg-[#228B22]">
                {simulateOffline || !isOnline ? "Save Batch Offline (IndexedDB)" : t.actions.createBatch}
              </button>
            </form>

            <form onSubmit={handleAnalyze} className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-3.5">
              <h2 className="font-extrabold text-sm text-[#14532D] flex items-center gap-2">
                <ScanEye className="w-4 h-4 text-[#228B22]" />
                2. Upload Crop Image &amp; Run OpenCV Inspection
              </h2>
              <select
                value={inspectForm.batch_id}
                onChange={(e) => {
                  const found = crops.find((c) => String(c.id) === e.target.value);
                  setInspectForm({
                    batch_id: e.target.value,
                    crop_type: found?.crop_type || inspectForm.crop_type,
                    variety: found?.variety || inspectForm.variety,
                    location: found?.origin_location || inspectForm.location,
                  });
                }}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              >
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.batch_id} — {c.crop_type} ({c.variety})
                  </option>
                ))}
              </select>

              <label className="block border-2 border-dashed border-emerald-300 rounded-2xl p-4 bg-[#F7FBEF] hover:bg-[#ECFCCB]/50 cursor-pointer text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />
                {cropPreview ? (
                  <div className="flex items-center gap-3 text-left">
                    <img src={cropPreview} alt="Crop preview" className="w-16 h-16 rounded-xl object-cover border border-emerald-200" />
                    <div className="text-xs">
                      <div className="font-bold text-[#14532D]">{cropFile?.name}</div>
                      <div className="text-gray-600">{Math.round((cropFile?.size || 0) / 1024)} KB · Click to change photo</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-xs text-[#14532D]">
                    <UploadCloud className="w-6 h-6 text-[#228B22]" />
                    <span className="font-bold">Click or drop a crop image (JPG / PNG) for real OpenCV pixel analysis</span>
                    <span className="text-[11px] text-gray-500">Auto-compressed to max 800px before CV defect &amp; color scoring</span>
                  </div>
                )}
              </label>

              <button
                type="submit"
                disabled={analyzing}
                className="w-full py-2.5 rounded-xl drishti-gradient text-white text-xs font-bold disabled:opacity-60"
              >
                {analyzing ? "Compressing & Running OpenCV CV Pipeline..." : t.actions.analyzeCrop}
              </button>
            </form>
          </div>

          {result && (
            <div className="bg-white rounded-2xl p-6 border-2 border-[#A3E635] shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#228B22] uppercase tracking-wider">{result.inspection_id}</div>
                  <div className="font-extrabold text-lg text-[#14532D]">
                    {result.crop_type} ({result.variety}) — Quality Score {result.quality_score}/100
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <GradeBadge grade={result.final_grade} />
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F7FBEF] border border-emerald-200 text-xs font-bold text-[#14532D]">
                    <Clock className="w-3.5 h-3.5 text-[#228B22]" />
                    {result.inference_time_ms} ms
                  </span>
                  {activeBatch && (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/fair-price?batchId=${activeBatch.id}`)}
                      className="px-3.5 py-2 rounded-xl drishti-gradient text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      Calculate Fair Price for {activeBatch.batch_id}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                  <div className="text-gray-500">Surface Defects</div>
                  <div className="text-base font-extrabold text-[#14532D]">{result.defect_percent}%</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                  <div className="text-gray-500">Discoloration</div>
                  <div className="text-base font-extrabold text-[#14532D]">{result.discoloration_percent}%</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                  <div className="text-gray-500">Uniformity Score</div>
                  <div className="text-base font-extrabold text-[#14532D]">{result.uniformity_score}/100</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                  <div className="text-gray-500">Damage Level</div>
                  <div className="text-base font-extrabold text-[#14532D]">{result.damage_level}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start bg-[#F7FBEF] p-4 rounded-xl border border-emerald-100 text-xs">
                {result.image_url && (
                  <img
                    src={resolveBackendAsset(result.image_url)}
                    alt="Uploaded crop"
                    className="w-28 h-28 rounded-xl object-cover border border-emerald-200 shrink-0"
                  />
                )}
                <div className="space-y-1.5 flex-1">
                  <div className="font-bold text-[#14532D] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#228B22]" />
                    Engine Mode: <span className="font-mono text-[11px]">{result.analysis_mode}</span>
                  </div>
                  <p className="text-gray-700">{result.observations}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(result.detected_defects || []).map((d) => (
                      <span key={d} className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-[11px] font-semibold text-[#14532D]">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="font-mono text-[10px] text-gray-500 pt-1">SHA-256 Record Digest: {result.record_hash}</div>
                </div>
              </div>
            </div>
          )}

          {/* Offline Queue Viewer */}
          {offlineQueue.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-amber-900 flex items-center gap-2">
                  <WifiOff className="w-4 h-4" />
                  IndexedDB Offline Synchronization Queue ({offlineQueue.length})
                </h3>
                <button
                  type="button"
                  onClick={triggerSync}
                  disabled={!isOnline}
                  className="px-3 py-1.5 rounded-xl bg-[#14532D] text-[#D9F99D] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Queue Now
                </button>
              </div>
              <div className="space-y-2">
                {offlineQueue.map((item) => (
                  <div key={item.client_offline_id} className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#14532D]">{item.client_offline_id}</span> · {item.crop_type} ({item.variety}) · {item.quantity_kg} kg
                      <div className="text-[11px] text-gray-500">{item.sync_message}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold uppercase text-[10px]">
                      {item.sync_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Inspections */}
          <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card">
            <h2 className="font-extrabold text-sm text-[#14532D] mb-3">Recent Crop Inspections</h2>
            <div className="space-y-2">
              {inspections.slice(0, 8).map((item) => (
                <div key={item.inspection_id} className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-[#14532D]">{item.inspection_id}</span> · {item.batch_code} · {item.crop_type} ({item.variety}) · Score {item.quality_score}/100
                    <div className="text-[11px] text-gray-600">{item.observations}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={item.final_grade || item.estimated_grade} />
                    <button
                      type="button"
                      onClick={() => navigate(`/app/fair-price?batchId=${item.batch_id}`)}
                      className="px-2.5 py-1 rounded-lg bg-[#ECFCCB] text-[#14532D] font-bold hover:bg-[#D9F99D]"
                    >
                      Fair Price
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: MULTI-MODAL INTELLIGENCE FUSION */}
      {tab === "fusion" && (
        <div className="space-y-6">
          <form onSubmit={handleRunFusion} className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4">
            <h2 className="font-extrabold text-base text-[#14532D] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#228B22]" />
              Unified Multi-Modal Intelligence Fusion (Vision + OCR + Mandi Pricing + SHA-256 Passport)
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Crop Type"
                value={fusionForm.crop_type}
                onChange={(e) => setFusionForm({ ...fusionForm, crop_type: e.target.value })}
                className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <input
                type="text"
                required
                placeholder="Variety"
                value={fusionForm.variety}
                onChange={(e) => setFusionForm({ ...fusionForm, variety: e.target.value })}
                className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <input
                type="number"
                min="1"
                required
                placeholder="Quantity kg"
                value={fusionForm.quantity_kg}
                onChange={(e) => setFusionForm({ ...fusionForm, quantity_kg: e.target.value })}
                className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <input
                type="text"
                required
                placeholder="Origin Location"
                value={fusionForm.origin_location}
                onChange={(e) => setFusionForm({ ...fusionForm, origin_location: e.target.value })}
                className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <input
                type="text"
                required
                placeholder="Target Mandi"
                value={fusionForm.mandi_location}
                onChange={(e) => setFusionForm({ ...fusionForm, mandi_location: e.target.value })}
                className="px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="p-3 rounded-xl border border-dashed border-emerald-300 bg-[#F7FBEF] text-xs cursor-pointer">
                <div className="font-bold text-[#14532D] mb-1">1. Crop Image (OpenCV Vision)</div>
                <input type="file" accept="image/*" onChange={(e) => setFusionCropFile(e.target.files?.[0] || null)} />
              </label>
              <label className="p-3 rounded-xl border border-dashed border-emerald-300 bg-[#F7FBEF] text-xs cursor-pointer">
                <div className="font-bold text-[#14532D] mb-1">2. Packaging Label Image (RapidOCR)</div>
                <input type="file" accept="image/*" onChange={(e) => setFusionLabelFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <textarea
              rows={2}
              value={fusionForm.sample_label_text}
              onChange={(e) => setFusionForm({ ...fusionForm, sample_label_text: e.target.value })}
              placeholder="Optional fallback label text if no label photo is selected..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            />

            <button
              type="submit"
              disabled={runningFusion}
              className="px-6 py-3 rounded-xl drishti-gradient text-white text-xs font-extrabold"
            >
              {runningFusion ? "Executing Connected 3-Modal Pipeline..." : "Execute Multi-Modal Fusion Pipeline"}
            </button>
          </form>

          {fusionResult && (
            <div className="bg-white rounded-2xl p-6 border-2 border-[#228B22] shadow-card space-y-4 text-xs">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="text-base font-extrabold text-[#14532D]">
                  Fusion Complete: {fusionResult.batch.batch_id} ({fusionResult.total_pipeline_ms} ms)
                </div>
                {fusionResult.passport && (
                  <button
                    type="button"
                    onClick={() => navigate(`/verify/${fusionResult.passport.passport_id}`)}
                    className="px-3.5 py-2 rounded-xl bg-[#14532D] text-[#D9F99D] font-bold"
                  >
                    Open Verified Passport {fusionResult.passport.passport_id}
                  </button>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#F7FBEF] border border-emerald-100 space-y-1">
                  <div className="font-extrabold text-[#228B22]">1. Vision Layer</div>
                  <div className="font-bold text-[#14532D]">Grade {fusionResult.vision.grade} ({fusionResult.vision.quality_score}/100)</div>
                  <div>Defects: {fusionResult.vision.defect_percent}% · Discoloration: {fusionResult.vision.discoloration_percent}%</div>
                  <div className="text-[11px] text-gray-500">{fusionResult.vision.inference_time_ms} ms</div>
                </div>
                <div className="p-4 rounded-xl bg-[#F7FBEF] border border-emerald-100 space-y-1">
                  <div className="font-extrabold text-[#228B22]">2. OCR Compliance</div>
                  <div className="font-bold text-[#14532D]">Status: {fusionResult.compliance.status}</div>
                  <div>Missing: {fusionResult.compliance.missing_fields.length} · Inconsistencies: {fusionResult.compliance.inconsistencies.length}</div>
                  <div className="text-[11px] text-gray-500">{fusionResult.compliance.ocr_engine}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#F7FBEF] border border-emerald-100 space-y-1">
                  <div className="font-extrabold text-[#228B22]">3. Fair Price Engine</div>
                  <div className="font-bold text-[#14532D]">₹{fusionResult.pricing.indicative_avg_per_quintal.toLocaleString("en-IN")}/quintal</div>
                  <div>Total Lot: ₹{fusionResult.pricing.estimated_total_value.toLocaleString("en-IN")}</div>
                  <div className="text-[11px] text-gray-500">{fusionResult.pricing.matched_mandi}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HUMAN-IN-THE-LOOP CALIBRATION */}
      {tab === "calibration" && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
              <div className="text-xs text-gray-500">AI vs Inspector Agreement Rate</div>
              <div className="text-3xl font-extrabold text-[#14532D] mt-1">{calStats?.agreement_rate_percent ?? 100}%</div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
              <div className="text-xs text-gray-500">Total Calibration Reviews</div>
              <div className="text-3xl font-extrabold text-[#14532D] mt-1">{calStats?.total_reviews ?? 0}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
              <div className="text-xs text-gray-500">Human Grade Corrections</div>
              <div className="text-3xl font-extrabold text-[#228B22] mt-1">{calStats?.corrected_count ?? 0}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            <form onSubmit={handleReviewSubmit} className="lg:col-span-5 bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-3.5">
              <h2 className="font-extrabold text-sm text-[#14532D] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#228B22]" />
                Inspector Grade Review &amp; Calibration
              </h2>
              <select
                value={reviewForm.inspection_id}
                onChange={(e) => setReviewForm({ ...reviewForm, inspection_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              >
                {inspections.map((i) => (
                  <option key={i.inspection_id} value={i.inspection_id}>
                    {i.inspection_id} · {i.crop_type} (AI Grade: {i.ai_grade || i.estimated_grade})
                  </option>
                ))}
              </select>
              <select
                value={reviewForm.corrected_grade}
                onChange={(e) => setReviewForm({ ...reviewForm, corrected_grade: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              >
                <option value="A">Calibrated Grade A (Premium)</option>
                <option value="B">Calibrated Grade B (Standard)</option>
                <option value="C">Calibrated Grade C (Economy)</option>
              </select>
              <input
                type="text"
                required
                placeholder="Reviewer Name & Credential"
                value={reviewForm.reviewer_name}
                onChange={(e) => setReviewForm({ ...reviewForm, reviewer_name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <textarea
                rows={2}
                required
                placeholder="Correction or Confirmation Reason"
                value={reviewForm.correction_reason}
                onChange={(e) => setReviewForm({ ...reviewForm, correction_reason: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <button type="submit" className="w-full py-2.5 rounded-xl drishti-gradient text-white text-xs font-bold">
                Record Inspector Review
              </button>
              <div className="text-[11px] text-gray-500">
                Governance: Logged to calibration dataset for controlled offline validation — never auto-retrains live weights blindly.
              </div>
            </form>

            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-3">
              <h2 className="font-extrabold text-sm text-[#14532D]">Calibration Feedback Dataset</h2>
              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {(calStats?.recent_feedback || []).map((f) => (
                  <div key={f.feedback_id} className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100 text-xs flex justify-between gap-3">
                    <div>
                      <div className="font-bold text-[#14532D]">
                        {f.feedback_id} · {f.batch_code} ({f.crop_type})
                      </div>
                      <div className="text-gray-700 mt-0.5">{f.correction_reason}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Reviewer: {f.reviewer_name}</div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        f.agreement_flag ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {f.agreement_flag ? "AI Agreed" : `AI ${f.original_ai_grade} -> ${f.corrected_grade}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
