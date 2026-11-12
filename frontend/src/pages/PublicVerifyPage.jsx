import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  GitBranch,
  IndianRupee,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Logo from "../components/Logo";
import { drishtiApi, resolveBackendAsset } from "../services/api";
import { formatDateTime, formatINR } from "../utils/formatters";
import { ComplianceBadge, DemoBadge, GradeBadge } from "../components/StatusBadge";

export default function PublicVerifyPage() {
  const { passportId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buyerName, setBuyerName] = useState("FreshBasket Retail Buyer");
  const [recordingScan, setRecordingScan] = useState(false);

  const loadVerification = (recordScan = false) => {
    setLoading(true);
    drishtiApi
      .verifyPassport(passportId, recordScan)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVerification(false);
  }, [passportId]);

  const handleConfirmBuyerScan = async () => {
    setRecordingScan(true);
    try {
      await drishtiApi.logPassportVerifyScan(passportId, {
        verifier_name: buyerName,
        verifier_role: "buyer",
        notes: "Buyer verified Digital Quality Passport via QR scan.",
      });
      loadVerification(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordingScan(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7FBEF] flex items-center justify-center p-6 text-sm font-bold text-[#14532D]">
        Verifying Digital Quality Passport {passportId}...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F7FBEF] flex flex-col items-center justify-center p-6 text-center">
        <Logo size="lg" showText />
        <div className="mt-6 bg-white p-6 rounded-2xl border border-rose-200 max-w-md">
          <div className="text-base font-bold text-rose-800">Passport Verification Failed</div>
          <p className="text-xs text-gray-600 mt-1">{error || "Passport record not found."}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to DRISHTI 360
          </Link>
        </div>
      </div>
    );
  }

  const { passport, integrity, inspection, compliance, pricing, traceability_events, verification_history } = data;

  return (
    <div className="min-h-screen bg-[#F7FBEF] py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo size="md" showText subtitle />
          <div className="flex items-center gap-2">
            <DemoBadge isDemo={passport.is_demo} label="Demo Verified Batch" />
            <Link
              to="/app/digital-passport"
              className="px-3.5 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-[#14532D] hover:bg-[#ECFCCB]"
            >
              Open Dashboard
            </Link>
          </div>
        </div>

        {/* Passport Summary */}
        <div className="bg-white rounded-3xl border-2 border-[#228B22]/30 shadow-card overflow-hidden">
          <div className="drishti-gradient p-6 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A3E635] text-[#14532D] text-[11px] font-extrabold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                {passport.verification_status}
              </div>
              <h1 className="text-2xl font-extrabold">{passport.passport_id}</h1>
              <div className="text-xs text-[#D9F99D]">
                Batch {passport.batch_code} · Issued {formatDateTime(passport.issued_at)}
              </div>
            </div>
            <a
              href={drishtiApi.getPassportPdfUrl(passport.passport_id)}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-xl bg-white text-[#14532D] text-xs font-extrabold hover:bg-[#ECFCCB] flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF Certificate
            </a>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <GradeBadge grade={passport.grade} />
              <ComplianceBadge status={passport.compliance_status} />
              <span className="px-3 py-0.5 rounded-full bg-[#F7FBEF] border border-emerald-200 text-xs font-bold text-[#14532D]">
                Quality Score: {passport.quality_score}/100
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                <div className="text-gray-500">Crop &amp; Variety</div>
                <div className="font-extrabold text-[#14532D] text-sm">
                  {passport.crop_name} ({passport.variety})
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F7FBEF] border border-emerald-100">
                <div className="text-gray-500">Farmer, Origin &amp; Lot Size</div>
                <div className="font-bold text-[#14532D]">
                  {passport.farmer_name} · {passport.origin_location} ({passport.quantity_kg} kg)
                </div>
              </div>
            </div>

            {inspection && (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-emerald-100 text-xs text-gray-700">
                <span className="font-bold text-[#14532D]">Inspection ({inspection.inspection_id}): </span>
                {inspection.observations}
              </div>
            )}

            {pricing && (
              <div className="p-4 rounded-2xl bg-[#ECFCCB]/70 border border-[#A3E635] text-xs space-y-1">
                <div className="font-extrabold text-[#14532D] flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4 text-[#228B22]" />
                  Grade-Linked Fair Price Reference: {formatINR(pricing.indicative_avg_per_quintal)}/quintal
                  (Total Batch Value: {formatINR(pricing.estimated_total_value)})
                </div>
                <div className="text-gray-700">{pricing.calculation_explanation}</div>
              </div>
            )}

            {compliance && (
              <div className="p-3.5 rounded-xl bg-[#F7FBEF] border border-emerald-100 text-xs space-y-2">
                <div>
                  <span className="font-bold text-[#14532D]">
                    Compliance ({compliance.compliance_id}): {compliance.status}
                  </span>{" "}
                  — {compliance.notes}
                </div>
                {(inspection?.image_url || compliance?.image_url) && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {inspection?.image_url && (
                      <img
                        src={resolveBackendAsset(inspection.image_url)}
                        alt="Crop inspection evidence"
                        className="h-20 rounded-xl border border-emerald-200 object-cover"
                      />
                    )}
                    {compliance?.image_url && (
                      <img
                        src={resolveBackendAsset(compliance.image_url)}
                        alt="Label compliance evidence"
                        className="h-20 rounded-xl border border-emerald-200 object-cover"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SHA-256 Integrity Check */}
            {integrity && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                  integrity.is_intact
                    ? "bg-emerald-50 border-emerald-200 text-[#14532D]"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold">
                  <span className="flex items-center gap-1.5">
                    {integrity.is_intact ? <Lock className="w-4 h-4 text-[#228B22]" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    SHA-256 Record Integrity: {integrity.integrity_status}
                  </span>
                  <span className="text-[11px] font-semibold">Verified Scans: {passport.verification_count || 0}</span>
                </div>
                <div className="font-mono text-[10px] break-all">
                  Stored Passport Hash: {integrity.stored_hashes?.passport_hash}
                </div>
                <div className="font-mono text-[10px] break-all">
                  Recomputed Live Hash: {integrity.recomputed_hashes?.passport_hash}
                </div>
                {integrity.mismatches?.length > 0 && (
                  <div className="font-bold text-rose-700">
                    Tampering / Post-Issuance Modification Detected: {integrity.mismatches.join(", ")}
                  </div>
                )}
                <div className="text-[10px] opacity-80">{integrity.method}</div>
              </div>
            )}

            {/* Buyer QR Verification Logger */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-100">
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Buyer / Inspector Name"
                className="px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF] flex-1 min-w-[200px]"
              />
              <button
                type="button"
                onClick={handleConfirmBuyerScan}
                disabled={recordingScan}
                className="px-4 py-2 rounded-xl bg-[#14532D] text-[#D9F99D] text-xs font-bold hover:bg-[#228B22]"
              >
                {recordingScan ? "Logging..." : "Log Buyer QR Verification Scan"}
              </button>
            </div>
          </div>
        </div>

        {/* Verification Scan History */}
        {verification_history?.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-card">
            <h2 className="font-extrabold text-base text-[#14532D] mb-3">
              Passport Verification History ({verification_history.length})
            </h2>
            <div className="space-y-2">
              {verification_history.map((vh) => (
                <div key={vh.log_id} className="p-3 rounded-xl bg-[#F7FBEF] border border-emerald-100 flex flex-wrap justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-[#14532D]">{vh.verifier_name}</span> ({vh.verifier_role}) ·{" "}
                    <span className="text-gray-600">{vh.notes}</span>
                  </div>
                  <div className="text-[11px] font-bold text-[#228B22]">
                    {vh.integrity_status} · {formatDateTime(vh.verified_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Traceability Timeline */}
        <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-card">
          <h2 className="font-extrabold text-base text-[#14532D] mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#228B22]" />
            Auditable Traceability Ledger ({traceability_events.length} Events)
          </h2>
          <div className="space-y-3">
            {traceability_events.map((ev) => (
              <div
                key={ev.event_id}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#F7FBEF] border border-emerald-100"
              >
                <div className="w-7 h-7 rounded-full bg-[#14532D] text-[#D9F99D] text-xs font-extrabold flex items-center justify-center shrink-0">
                  {ev.stage_number}
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex flex-wrap justify-between gap-2 font-bold text-[#14532D]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#228B22]" />
                      {ev.stage_name}
                    </span>
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(ev.recorded_at)}
                    </span>
                  </div>
                  <div className="text-gray-700 mt-1">{ev.notes}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Actor: {ev.actor} · {ev.location} · ID: {ev.event_id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
