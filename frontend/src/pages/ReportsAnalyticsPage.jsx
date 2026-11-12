import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3 } from "lucide-react";
import { drishtiApi } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

export default function ReportsAnalyticsPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [crops, setCrops] = useState([]);

  useEffect(() => {
    Promise.all([drishtiApi.getDashboardStats(), drishtiApi.getCrops()]).then(([s, c]) => {
      setStats(s);
      setCrops(c);
    });
  }, []);

  if (!stats) {
    return <div className="text-sm text-[#14532D]">Loading analytics...</div>;
  }

  const gradeData = [
    { grade: "Grade A", count: stats.grade_distribution.A || 0 },
    { grade: "Grade B", count: stats.grade_distribution.B || 0 },
    { grade: "Grade C", count: stats.grade_distribution.C || 0 },
  ];

  const complianceData = [
    { status: "PASS", count: stats.compliance_summary.PASS || 0 },
    { status: "REVIEW", count: stats.compliance_summary.REVIEW || 0 },
    { status: "FLAGGED", count: stats.compliance_summary.FLAGGED || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#14532D] flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#228B22]" />
          {t.nav.reports}
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Live analytics aggregated from FastAPI dashboard stats and batch records.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card h-72">
          <h2 className="font-bold text-sm text-[#14532D] mb-3">Grade Distribution</h2>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECFCCB" />
              <XAxis dataKey="grade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#228B22" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card h-72">
          <h2 className="font-bold text-sm text-[#14532D] mb-3">Compliance Overview</h2>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={complianceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECFCCB" />
              <XAxis dataKey="status" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#14532D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card">
        <h2 className="font-bold text-sm text-[#14532D] mb-3">All Registered Crop Batches ({crops.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-emerald-100 text-gray-500">
                <th className="py-2">Batch ID</th>
                <th className="py-2">Crop</th>
                <th className="py-2">Quantity (kg)</th>
                <th className="py-2">Origin</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c.batch_id} className="border-b border-emerald-50">
                  <td className="py-2 font-bold text-[#14532D]">{c.batch_id}</td>
                  <td className="py-2">{c.crop_type} ({c.variety})</td>
                  <td className="py-2">{c.quantity_kg}</td>
                  <td className="py-2 text-gray-600">{c.origin_location}</td>
                  <td className="py-2 uppercase font-semibold text-[#228B22]">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
