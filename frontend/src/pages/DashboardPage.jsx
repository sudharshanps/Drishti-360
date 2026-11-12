import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  IndianRupee,
  QrCode,
  ScanEye,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { drishtiApi } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { formatDateTime, formatINR } from "../utils/formatters";
import { GradeBadge, ComplianceBadge, DemoBadge } from "../components/StatusBadge";

const COLORS = ["#14532D", "#228B22", "#A3E635"];

export default function DashboardPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { notify } = useOutletContext() || {};

  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([drishtiApi.getHealth(), drishtiApi.getDashboardStats()])
      .then(([h, s]) => {
        setHealth(h);
        setStats(s);
      })
      .catch((err) => notify?.(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm font-semibold text-[#14532D]">Connecting to DRISHTI 360 FastAPI backend...</div>;
  }

  if (!stats) {
    return (
      <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
        Unable to load dashboard stats from backend.
      </div>
    );
  }

  const gradeChart = [
    { name: "Grade A", value: stats.grade_distribution.A || 0 },
    { name: "Grade B", value: stats.grade_distribution.B || 0 },
    { name: "Grade C", value: stats.grade_distribution.C || 0 },
  ];

  const complianceChart = [
    { status: "PASS", count: stats.compliance_summary.PASS || 0 },
    { status: "REVIEW", count: stats.compliance_summary.REVIEW || 0 },
    { status: "FLAGGED", count: stats.compliance_summary.FLAGGED || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#14532D]">{t.nav.overview}</h1>
            <DemoBadge label="Demo Data Included" />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Backend Health: <span className="font-bold text-[#228B22]">{health?.status?.toUpperCase()}</span> · DB:{" "}
            <span className="font-semibold">{health?.database_dialect}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/app/crop-intelligence")}
            className="px-3.5 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-[#14532D] hover:bg-[#ECFCCB]"
          >
            + Crop Inspection
          </button>
          <button
            onClick={() => navigate("/app/fair-price")}
            className="px-3.5 py-2 rounded-xl bg-[#228B22] text-white text-xs font-bold hover:bg-[#14532D]"
          >
            Open Fair Price Engine
          </button>
          <button
            onClick={() => navigate("/app/digital-passport")}
            className="px-3.5 py-2 rounded-xl bg-[#14532D] text-[#D9F99D] text-xs font-bold"
          >
            Open Digital Passport
          </button>
        </div>
      </div>

      {/* Prominent Flagship Innovations Showcase */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-3xl p-6 drishti-gradient text-white shadow-glow flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A3E635] text-[#14532D] text-[11px] font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Flagship Innovation #1
            </div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-[#D9F99D]" />
                {t.nav.fairPrice}
              </h2>
              <span className="text-xl font-extrabold text-[#D9F99D]">
                {formatINR(stats.average_indicative_price)}/qtl
              </span>
            </div>
            <p className="text-xs text-emerald-100 leading-relaxed">
              Combines mandi benchmark modal prices with crop quality grade (A: +12%, B: baseline, C: -18%), variety, location &amp; seasonal factors for transparent fair value discovery.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/15">
            <span className="text-[11px] text-[#D9F99D] font-semibold">
              Linked to stored crop batch &amp; inspection grades
            </span>
            <button
              onClick={() => navigate("/app/fair-price")}
              className="px-4 py-2 rounded-xl bg-white text-[#14532D] text-xs font-extrabold hover:bg-[#ECFCCB] flex items-center gap-1.5 transition"
            >
              Launch Price Engine
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-3xl p-6 bg-white border-2 border-[#228B22]/40 shadow-card flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#14532D] text-[#A3E635] text-[11px] font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Flagship Innovation #2
            </div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-[#14532D] flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#228B22]" />
                {t.nav.digitalPassport}
              </h2>
              <span className="text-xl font-extrabold text-[#228B22]">
                {stats.total_passports} Certified
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Generates tamper-traceable Digital Quality Passports with downloadable branded PDF certificates, unique scannable QR codes, and live buyer verification pages.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-100">
            <button
              onClick={() => navigate("/verify/DR360-PSP-2026-0001")}
              className="text-xs font-bold text-[#228B22] hover:underline"
            >
              Preview Sample QR Page →
            </button>
            <button
              onClick={() => navigate("/app/digital-passport")}
              className="px-4 py-2 rounded-xl bg-[#14532D] text-[#D9F99D] text-xs font-extrabold hover:bg-[#228B22] hover:text-white flex items-center gap-1.5 transition"
            >
              Generate Passport &amp; QR
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>{t.labels.totalBatches}</span>
            <Boxes className="w-4 h-4 text-[#228B22]" />
          </div>
          <div className="text-3xl font-extrabold text-[#14532D] mt-2">{stats.total_batches}</div>
          <div className="text-[11px] text-[#228B22] mt-1">{stats.total_inspections} inspections logged</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>{t.labels.avgPrice}</span>
            <IndianRupee className="w-4 h-4 text-[#228B22]" />
          </div>
          <div className="text-2xl font-extrabold text-[#14532D] mt-2">{formatINR(stats.average_indicative_price)}</div>
          <div className="text-[11px] text-gray-600 mt-1">Per quintal indicative benchmark</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>{t.labels.complianceStatus}</span>
            <ShieldCheck className="w-4 h-4 text-[#228B22]" />
          </div>
          <div className="text-2xl font-extrabold text-[#14532D] mt-2">
            {stats.compliance_summary.PASS} PASS
          </div>
          <div className="text-[11px] text-gray-600 mt-1">
            {stats.compliance_summary.REVIEW} Review · {stats.compliance_summary.FLAGGED} Flagged
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>{t.labels.digitalPassports}</span>
            <QrCode className="w-4 h-4 text-[#228B22]" />
          </div>
          <div className="text-3xl font-extrabold text-[#14532D] mt-2">{stats.total_passports}</div>
          <div className="text-[11px] text-[#228B22] mt-1">
            {stats.integrity_summary?.intact ?? stats.total_passports} SHA-256 intact
          </div>
        </div>
      </div>

      {/* Advanced Analytics Strip (FPO, Inspector Calibration, Pending, Traceability) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-card text-xs">
          <div className="text-gray-500 font-semibold">Pending Crop Inspections</div>
          <div className="text-2xl font-extrabold text-[#14532D] mt-1">{stats.pending_inspections ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Awaiting visual CV screening</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-card text-xs">
          <div className="text-gray-500 font-semibold">Inspector AI Agreement</div>
          <div className="text-2xl font-extrabold text-[#228B22] mt-1">
            {stats.inspector_stats?.agreement_rate_percent ?? 100}%
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {stats.inspector_stats?.corrections_count ?? 0} human calibration(s) of {stats.inspector_stats?.total_reviews ?? 0}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-card text-xs">
          <div className="text-gray-500 font-semibold">FPO Aggregated Volume</div>
          <div className="text-2xl font-extrabold text-[#14532D] mt-1">
            {stats.fpo_stats?.total_quantity_quintals ?? 0} qtl
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Across {stats.fpo_stats?.active_fpos ?? 1} active FPO(s)
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-card text-xs">
          <div className="text-gray-500 font-semibold">Traceability Ledger Events</div>
          <div className="text-2xl font-extrabold text-[#14532D] mt-1">{stats.total_traceability_events ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Hash-chained farm-to-market events</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <h2 className="font-bold text-sm text-[#14532D] mb-3">Grade Distribution (A / B / C)</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gradeChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {gradeChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <h2 className="font-bold text-sm text-[#14532D] mb-3">Compliance Summary</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complianceChart}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Checks" fill="#228B22" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Batches & Activity */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <h2 className="font-bold text-sm text-[#14532D] mb-3 flex items-center gap-2">
            <ScanEye className="w-4 h-4 text-[#228B22]" />
            Recent Crop Batches
          </h2>
          <div className="space-y-2.5">
            {stats.recent_batches.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold text-[#14532D]">
                    {b.batch_id} · {b.crop_type} ({b.variety})
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {b.quantity_kg} kg · {b.origin_location}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {b.grade && <GradeBadge grade={b.grade} />}
                  {b.compliance && <ComplianceBadge status={b.compliance} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
          <h2 className="font-bold text-sm text-[#14532D] mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#228B22]" />
            Latest Traceability Activity
          </h2>
          <div className="space-y-2.5">
            {stats.recent_events.map((ev) => (
              <div key={ev.event_id} className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100 text-xs">
                <div className="flex justify-between font-bold text-[#14532D]">
                  <span>Stage {ev.stage_number}: {ev.stage_name}</span>
                  <span className="text-[10px] text-gray-500">{formatDateTime(ev.recorded_at)}</span>
                </div>
                <div className="text-gray-600 mt-0.5">{ev.notes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
