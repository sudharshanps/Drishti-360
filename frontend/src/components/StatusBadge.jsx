import React from "react";

export function GradeBadge({ grade }) {
  const styles = {
    A: "bg-[#14532D] text-[#D9F99D] border-[#228B22]",
    B: "bg-[#ECFCCB] text-[#14532D] border-[#A3E635]",
    C: "bg-amber-50 text-amber-800 border-amber-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
        styles[grade] || "bg-gray-100 text-gray-700 border-gray-300"
      }`}
    >
      Grade {grade || "-"}
    </span>
  );
}

export function ComplianceBadge({ status }) {
  const styles = {
    PASS: "bg-emerald-50 text-emerald-800 border-emerald-300",
    REVIEW: "bg-amber-50 text-amber-800 border-amber-300",
    FLAGGED: "bg-rose-50 text-rose-800 border-rose-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
        styles[status] || "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {status || "PENDING"}
    </span>
  );
}

export function DemoBadge({ isDemo = true, label = "Demo Data" }) {
  if (!isDemo) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#D9F99D]/60 text-[#14532D] border border-[#A3E635]">
      {label}
    </span>
  );
}
