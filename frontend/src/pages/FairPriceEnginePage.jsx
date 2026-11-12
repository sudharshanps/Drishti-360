import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { ArrowRight, Calculator, Database, IndianRupee, Info, Sparkles } from "lucide-react";
import { drishtiApi } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { formatINR } from "../utils/formatters";
import { DemoBadge, GradeBadge } from "../components/StatusBadge";

export default function FairPriceEnginePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notify } = useOutletContext() || {};

  const [crops, setCrops] = useState([]);
  const [mandis, setMandis] = useState([]);
  const [estimates, setEstimates] = useState([]);

  const [form, setForm] = useState({
    batch_id: searchParams.get("batchId") || "",
    crop_type: "Turmeric",
    variety: "Erode Salem",
    mandi_location: "Erode Turmeric Market, Tamil Nadu",
    estimate_date: new Date().toISOString().slice(0, 10),
    grade: "A",
    quantity_kg: "1200",
  });
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const runEstimate = async (payload = form, showToast = false) => {
    setCalculating(true);
    try {
      const res = await drishtiApi.estimatePrice({
        batch_id: payload.batch_id ? Number(payload.batch_id) : null,
        crop_type: payload.crop_type,
        variety: payload.variety,
        mandi_location: payload.mandi_location,
        estimate_date: payload.estimate_date,
        grade: payload.grade,
        quantity_kg: Number(payload.quantity_kg),
      });
      setResult(res);
      if (showToast) {
        notify?.(`Fair Price computed: ${formatINR(res.indicative_avg_per_quintal)}/quintal`);
      }
      const saved = await drishtiApi.getPricingEstimates();
      setEstimates(saved);
    } catch (err) {
      notify?.(err.message, "error");
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    Promise.all([
      drishtiApi.getCrops(),
      drishtiApi.getMandiBenchmarks(),
      drishtiApi.getPricingEstimates(),
    ])
      .then(([cropList, mandiList, estList]) => {
        setCrops(cropList);
        setMandis(mandiList);
        setEstimates(estList);

        const paramId = searchParams.get("batchId");
        const target =
          (paramId && cropList.find((b) => String(b.id) === String(paramId))) || cropList[0];
        if (target) {
          const synced = {
            ...form,
            batch_id: String(target.id),
            crop_type: target.crop_type,
            variety: target.variety,
            mandi_location: target.mandi_location || target.origin_location,
            grade: target.grade || "A",
            quantity_kg: String(target.quantity_kg),
          };
          setForm(synced);
          runEstimate(synced, false);
        } else {
          runEstimate(form, false);
        }
      })
      .catch((err) => notify?.(err.message, "error"));
  }, []);

  const handleBatchSelect = (selectedId) => {
    if (!selectedId) {
      setForm((prev) => ({ ...prev, batch_id: "" }));
      return;
    }
    const found = crops.find((c) => String(c.id) === String(selectedId));
    if (found) {
      const next = {
        ...form,
        batch_id: String(found.id),
        crop_type: found.crop_type,
        variety: found.variety,
        mandi_location: found.mandi_location || found.origin_location,
        grade: found.grade || "A",
        quantity_kg: String(found.quantity_kg),
      };
      setForm(next);
      runEstimate(next, true);
    }
  };

  const uniqueCrops = [...new Set(mandis.map((m) => m.crop_type))];
  const uniqueMandis = [...new Set(mandis.map((m) => m.mandi_name))];
  const varietiesForCrop = [
    ...new Set(mandis.filter((m) => m.crop_type === form.crop_type).map((m) => m.variety)),
  ];

  return (
    <div className="space-y-6">
      {/* Flagship Header */}
      <div className="rounded-3xl p-6 drishti-gradient text-white shadow-glow flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A3E635] text-[#14532D] text-[11px] font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Flagship Innovation #1 · Grade-Linked Fair Price Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
            <IndianRupee className="w-7 h-7 text-[#D9F99D]" />
            {t.nav.fairPrice}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl">
            Combines mandi benchmark modal prices with assessed crop quality grade, variety, location, and seasonal date factors to give farmers transparent price discovery.
          </p>
        </div>

        <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-xs shrink-0">
          <div className="font-bold text-[#D9F99D]">Grade Adjustment Multipliers</div>
          <div className="mt-1 space-y-0.5 text-emerald-50">
            <div>Grade A: 1.12× (+12% Quality Premium)</div>
            <div>Grade B: 1.00× (Mandi Modal Baseline)</div>
            <div>Grade C: 0.82× (-18% Economy Discount)</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runEstimate(form, true);
          }}
          className="lg:col-span-4 bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-sm text-[#14532D] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#228B22]" />
              Price Estimation Inputs
            </h2>
            <DemoBadge label="Sample Mandi Data" />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14532D] mb-1">
              Sync from Inspected Crop Batch
            </label>
            <select
              value={form.batch_id}
              onChange={(e) => handleBatchSelect(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            >
              <option value="">-- Simulation Preview (No Batch) --</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.batch_id} · {c.crop_type} (Grade {c.grade || "?"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#14532D] mb-1">Crop Type</label>
              <select
                value={form.crop_type}
                onChange={(e) => {
                  const nextCrop = e.target.value;
                  const firstVar = mandis.find((m) => m.crop_type === nextCrop)?.variety || form.variety;
                  setForm({ ...form, crop_type: nextCrop, variety: firstVar });
                }}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              >
                {(uniqueCrops.length ? uniqueCrops : ["Turmeric", "Tomato", "Red Onion", "Mango", "Basmati Rice"]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#14532D] mb-1">Variety</label>
              <select
                value={form.variety}
                onChange={(e) => setForm({ ...form, variety: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              >
                {(varietiesForCrop.length ? varietiesForCrop : [form.variety]).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14532D] mb-1">Mandi / Market Location</label>
            <select
              value={form.mandi_location}
              onChange={(e) => setForm({ ...form, mandi_location: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            >
              {!uniqueMandis.includes(form.mandi_location) && (
                <option value={form.mandi_location}>{form.mandi_location}</option>
              )}
              {uniqueMandis.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#14532D] mb-1">Date</label>
              <input
                type="date"
                value={form.estimate_date}
                onChange={(e) => setForm({ ...form, estimate_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#14532D] mb-1">Quantity (kg)</label>
              <input
                type="number"
                min="1"
                required
                value={form.quantity_kg}
                onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14532D] mb-1.5">Quality Grade</label>
            <div className="grid grid-cols-3 gap-2">
              {["A", "B", "C"].map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setForm({ ...form, grade: g })}
                  className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                    form.grade === g
                      ? "bg-[#14532D] text-[#D9F99D] border-[#14532D]"
                      : "bg-[#F7FBEF] text-[#14532D] border-emerald-200"
                  }`}
                >
                  Grade {g}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={calculating}
            className="w-full py-3 rounded-xl drishti-gradient text-white text-xs font-bold shadow-glow hover:opacity-95 transition"
          >
            {calculating ? "Calculating..." : t.actions.calculatePrice}
          </button>
        </form>

        {/* Results & Charts */}
        <div className="lg:col-span-8 space-y-5">
          {result && (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
                  <div className="text-xs font-semibold text-gray-500">Standard Mandi Benchmark</div>
                  <div className="text-2xl font-extrabold text-[#172B1B] mt-1.5">
                    {formatINR(result.benchmark_price_per_quintal)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Modal ₹/quintal · {result.matched_mandi}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#14532D] to-[#228B22] text-white rounded-2xl p-5 shadow-glow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#D9F99D]">Grade-Adjusted Fair Price</span>
                    <GradeBadge grade={result.grade} />
                  </div>
                  <div className="text-2xl font-extrabold mt-1.5">
                    {formatINR(result.indicative_avg_per_quintal)}
                  </div>
                  <div className="text-[11px] text-[#D9F99D] mt-1">
                    Range: {formatINR(result.indicative_min_per_quintal)} – {formatINR(result.indicative_max_per_quintal)}/qtl
                  </div>
                </div>

                <div className="bg-[#ECFCCB] rounded-2xl p-5 border border-[#A3E635] shadow-card">
                  <div className="text-xs font-bold text-[#14532D]">{t.labels.estimatedBatchValue}</div>
                  <div className="text-2xl font-extrabold text-[#14532D] mt-1.5">
                    {formatINR(result.estimated_total_value)}
                  </div>
                  <div className="text-[11px] text-[#14532D]/80 mt-1">
                    {result.quantity_kg} kg ({(result.quantity_kg / 100).toFixed(2)} quintals)
                  </div>
                </div>
              </div>

              {/* Grade Comparison Chart */}
              <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="font-bold text-sm text-[#14532D]">
                    Grade-Wise Fair Price vs Mandi Benchmark (₹/Quintal)
                  </h3>
                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-[#228B22]" />
                    Updated: {result.last_updated_date}
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.grade_comparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECFCCB" />
                      <XAxis dataKey="grade" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="benchmark" name="Mandi Modal" fill="#D9F99D" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="indicative_avg" name="Indicative Fair Price" fill="#228B22" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="indicative_max" name="Upper Band" fill="#14532D" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Historical Trend Chart */}
              {result.historical_trend?.length > 1 && (
                <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="font-bold text-sm text-[#14532D]">
                      7-Day Historical Mandi Benchmark vs Grade {result.grade} Trend (₹/Quintal)
                    </h3>
                    <span className="text-[11px] font-semibold text-[#228B22]">
                      Grade Input Source: {result.grade_source}
                    </span>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.historical_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ECFCCB" />
                        <XAxis dataKey="date" />
                        <YAxis domain={["auto", "auto"]} />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="mandi_modal"
                          name="Mandi Modal Benchmark"
                          stroke="#228B22"
                          fill="#D9F99D"
                          fillOpacity={0.55}
                        />
                        <Area
                          type="monotone"
                          dataKey="grade_adjusted"
                          name={`Grade ${result.grade} Indicative`}
                          stroke="#14532D"
                          fill="#228B22"
                          fillOpacity={0.25}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Calculation Explanation */}
              <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#14532D] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#228B22]" />
                    Calculation Explanation &amp; Market Data Source
                  </span>
                  <span className="text-[11px] font-semibold text-[#228B22]">
                    {result.live_api_used ? "LIVE API · " : ""}{result.data_source}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed bg-[#F7FBEF] p-3.5 rounded-xl border border-emerald-100">
                  {result.calculation_explanation}
                </p>

                {form.batch_id && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => navigate(`/app/digital-passport?batchId=${form.batch_id}`)}
                      className="px-4 py-2.5 rounded-xl bg-[#14532D] text-[#D9F99D] text-xs font-bold hover:bg-[#228B22] hover:text-white flex items-center gap-1.5 transition"
                    >
                      Generate Digital Quality Passport for this Batch
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reference Table & Saved Estimates */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-sm text-[#14532D]">Mandi Benchmark Dataset</h3>
            <DemoBadge label="Sample Mandi Data" />
          </div>
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-emerald-100 text-gray-500">
                  <th className="py-2">Crop / Variety</th>
                  <th className="py-2">Mandi</th>
                  <th className="py-2">Modal</th>
                </tr>
              </thead>
              <tbody>
                {mandis.map((m) => (
                  <tr key={m.id} className="border-b border-emerald-50">
                    <td className="py-2 font-semibold text-[#14532D]">{m.crop_type} ({m.variety})</td>
                    <td className="py-2 text-gray-600">{m.mandi_name}</td>
                    <td className="py-2 font-bold text-[#228B22]">{formatINR(m.modal_price_per_quintal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <h3 className="font-extrabold text-sm text-[#14532D] mb-3">Saved Batch Price Estimates</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {estimates.map((e) => (
              <div key={e.estimate_id} className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-[#14532D]">
                    {e.batch_code} · {e.crop_type} (Grade {e.grade})
                  </div>
                  <div className="text-[11px] text-gray-600">{e.mandi_location} · {e.quantity_kg} kg</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-[#228B22]">{formatINR(e.indicative_avg_per_quintal)}/qtl</div>
                  <div className="text-[10px] text-gray-500">Total {formatINR(e.estimated_total_value)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
