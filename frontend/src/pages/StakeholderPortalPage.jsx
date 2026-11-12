import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  Building2,
  CheckSquare,
  ExternalLink,
  IndianRupee,
  PackageCheck,
  QrCode,
  ShoppingBag,
  Sprout,
} from "lucide-react";
import { drishtiApi, resolveBackendAsset } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatINR } from "../utils/formatters";
import { ComplianceBadge, GradeBadge } from "../components/StatusBadge";

export default function StakeholderPortalPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useOutletContext() || {};

  const initialTab = searchParams.get("role") || user?.role || "fpo";
  const [tab, setTab] = useState(["farmer", "fpo", "buyer"].includes(initialTab) ? initialTab : "fpo");

  const [fpoData, setFpoData] = useState({ fpos: [], batches: [] });
  const [buyerCatalog, setBuyerCatalog] = useState([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [purchaseForm, setPurchaseForm] = useState({
    batch_id: "",
    buyer_name: "FreshBasket Retail Procurement",
    agreed_price_per_quintal: "14500",
    destination: "Chennai Central Retail Hub",
    notes: "Grade-verified lot procured with Digital Quality Passport.",
  });

  const loadAll = async () => {
    try {
      const [fpoRes, buyRes] = await Promise.all([
        drishtiApi.getFpoOverview(),
        drishtiApi.getBuyerCatalog(),
      ]);
      setFpoData(fpoRes);
      setBuyerCatalog(buyRes);
      if (!purchaseForm.batch_id && buyRes.length > 0) {
        setPurchaseForm((prev) => ({
          ...prev,
          batch_id: String(buyRes[0].id),
          agreed_price_per_quintal: String(buyRes[0].indicative_price_per_quintal || 5000),
        }));
      }
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const r = searchParams.get("role");
    if (r && ["farmer", "fpo", "buyer"].includes(r)) {
      setTab(r);
    }
  }, [searchParams]);

  const toggleSelect = (id) => {
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkCertify = async () => {
    if (!selectedBatchIds.length) {
      notify?.("Select at least one inspected batch for FPO bulk certification.", "error");
      return;
    }
    try {
      const res = await drishtiApi.fpoBulkCertify(selectedBatchIds);
      notify?.(`FPO Bulk Certified ${res.certified_count} batch(es)!`);
      setSelectedBatchIds([]);
      await loadAll();
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    try {
      const res = await drishtiApi.recordBuyerPurchase({
        ...purchaseForm,
        batch_id: Number(purchaseForm.batch_id),
        agreed_price_per_quintal: Number(purchaseForm.agreed_price_per_quintal),
      });
      notify?.(`Purchase ${res.transaction_id} logged for ${res.batch_code}!`);
      await loadAll();
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14532D] flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#228B22]" />
            Farmer, FPO &amp; Buyer Integration Portal
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Role-tailored views powered by unified CropBatch, Fair Price, Digital Passport, and Traceability APIs.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-white border border-emerald-200 p-1 text-xs font-bold">
          {[
            { id: "farmer", label: "Farmer View", icon: Sprout },
            { id: "fpo", label: "FPO Bulk Management", icon: PackageCheck },
            { id: "buyer", label: "Buyer Verification & Trade", icon: ShoppingBag },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${
                  tab === item.id ? "bg-[#14532D] text-[#D9F99D]" : "text-[#14532D] hover:bg-[#F7FBEF]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* FARMER VIEW */}
      {tab === "farmer" && (
        <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h2 className="font-extrabold text-sm text-[#14532D]">
              Farmer Produce Batches, Fair Price Estimates &amp; Passports
            </h2>
            <button
              type="button"
              onClick={() => navigate("/app/crop-intelligence")}
              className="px-3.5 py-2 rounded-xl drishti-gradient text-white text-xs font-bold"
            >
              + New Crop Batch / Inspection
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-emerald-100 text-gray-500">
                  <th className="py-2">Batch ID</th>
                  <th className="py-2">Crop &amp; Variety</th>
                  <th className="py-2">Qty (kg)</th>
                  <th className="py-2">Grade</th>
                  <th className="py-2">Fair Price</th>
                  <th className="py-2">Passport</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fpoData.batches.map((b) => (
                  <tr key={b.batch_id} className="border-b border-emerald-50">
                    <td className="py-2.5 font-bold text-[#14532D]">{b.batch_id}</td>
                    <td className="py-2.5">{b.crop_type} ({b.variety})</td>
                    <td className="py-2.5">{b.quantity_kg}</td>
                    <td className="py-2.5">{b.grade !== "Pending" ? <GradeBadge grade={b.grade} /> : "Pending"}</td>
                    <td className="py-2.5 font-bold text-[#228B22]">
                      {b.indicative_price_per_quintal ? `${formatINR(b.indicative_price_per_quintal)}/qtl` : "—"}
                    </td>
                    <td className="py-2.5 font-semibold">{b.passport_id || "Not issued"}</td>
                    <td className="py-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/fair-price?batchId=${b.id}`)}
                        className="px-2 py-1 rounded-lg bg-[#ECFCCB] text-[#14532D] font-bold"
                      >
                        Price
                      </button>
                      {b.passport_id && (
                        <button
                          type="button"
                          onClick={() => navigate(`/verify/${b.passport_id}`)}
                          className="px-2 py-1 rounded-lg bg-[#14532D] text-[#D9F99D] font-bold"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FPO BULK MANAGEMENT */}
      {tab === "fpo" && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            {fpoData.fpos.map((f) => (
              <div key={f.fpo_name} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card space-y-1">
                <div className="text-xs font-extrabold text-[#228B22]">{f.fpo_name}</div>
                <div className="text-xl font-extrabold text-[#14532D]">
                  {f.total_quantity_kg.toLocaleString("en-IN")} kg ({f.total_quantity_quintals} qtl)
                </div>
                <div className="text-xs text-gray-600">
                  {f.total_batches} batches · {f.certified_count} certified · Est. Value {formatINR(f.estimated_value_inr)}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-extrabold text-sm text-[#14532D]">
                Multi-Farmer Batch Comparison &amp; Bulk Certification
              </h2>
              <button
                type="button"
                onClick={handleBulkCertify}
                className="px-4 py-2 rounded-xl drishti-gradient text-white text-xs font-bold flex items-center gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                Bulk Certify Selected ({selectedBatchIds.length})
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-emerald-100 text-gray-500">
                    <th className="py-2">Select</th>
                    <th className="py-2">Batch</th>
                    <th className="py-2">Farmer &amp; FPO</th>
                    <th className="py-2">Crop (Qty)</th>
                    <th className="py-2">Quality</th>
                    <th className="py-2">Compliance</th>
                    <th className="py-2">Passport</th>
                  </tr>
                </thead>
                <tbody>
                  {fpoData.batches.map((b) => (
                    <tr key={b.batch_id} className="border-b border-emerald-50">
                      <td className="py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedBatchIds.includes(b.id)}
                          onChange={() => toggleSelect(b.id)}
                          disabled={Boolean(b.passport_id)}
                        />
                      </td>
                      <td className="py-2.5 font-bold text-[#14532D]">{b.batch_id}</td>
                      <td className="py-2.5">
                        <div className="font-semibold">{b.farmer_name}</div>
                        <div className="text-[11px] text-gray-500">{b.fpo_name}</div>
                      </td>
                      <td className="py-2.5">{b.crop_type} ({b.quantity_kg} kg)</td>
                      <td className="py-2.5">
                        {b.grade !== "Pending" ? (
                          <div className="flex items-center gap-1.5">
                            <GradeBadge grade={b.grade} />
                            <span>{b.quality_score}/100</span>
                          </div>
                        ) : (
                          "Pending"
                        )}
                      </td>
                      <td className="py-2.5"><ComplianceBadge status={b.compliance_status} /></td>
                      <td className="py-2.5 font-bold text-[#228B22]">{b.passport_id || "Ready to certify"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BUYER PROCUREMENT & QR VERIFICATION */}
      {tab === "buyer" && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            {buyerCatalog.map((item) => (
              <div key={item.batch_id} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-[#14532D]">{item.batch_id}</span>
                    {item.grade && <GradeBadge grade={item.grade} />}
                    <ComplianceBadge status={item.compliance_status} />
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 font-bold text-[#14532D]">
                      {item.integrity_status}
                    </span>
                  </div>
                  <div className="font-bold text-[#14532D]">
                    {item.crop_type} ({item.variety}) · {item.quantity_kg} kg · {item.origin_location}
                  </div>
                  <div className="text-gray-600">
                    FPO: {item.fpo_name} · Fair Price Ref:{" "}
                    <span className="font-extrabold text-[#228B22]">
                      {item.indicative_price_per_quintal ? `${formatINR(item.indicative_price_per_quintal)}/qtl` : "Pending"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.passport_id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/verify/${item.passport_id}`)}
                        className="px-3 py-1.5 rounded-xl bg-[#14532D] text-[#D9F99D] font-bold flex items-center gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Verify Passport {item.passport_id}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate("/app/traceability")}
                      className="px-3 py-1.5 rounded-xl bg-[#ECFCCB] text-[#14532D] font-bold"
                    >
                      Stages Complete: {item.traceability_stages.length}/9
                    </button>
                  </div>
                </div>
                {item.qr_image_url && (
                  <img
                    src={resolveBackendAsset(item.qr_image_url)}
                    alt="QR"
                    className="w-20 h-20 rounded-xl border border-emerald-200 p-1 bg-[#F7FBEF] shrink-0"
                  />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleRecordPurchase} className="lg:col-span-4 bg-white rounded-2xl p-6 border border-emerald-100 shadow-card space-y-3.5 h-fit">
            <h2 className="font-extrabold text-sm text-[#14532D] flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-[#228B22]" />
              Execute Buyer Procurement &amp; Trade
            </h2>
            <select
              value={purchaseForm.batch_id}
              onChange={(e) => {
                const chosen = buyerCatalog.find((b) => String(b.id) === e.target.value);
                setPurchaseForm({
                  ...purchaseForm,
                  batch_id: e.target.value,
                  agreed_price_per_quintal: String(chosen?.indicative_price_per_quintal || 5000),
                });
              }}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            >
              {buyerCatalog.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_id} — {b.crop_type} (Grade {b.grade || "?"})
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Buyer Organization"
              value={purchaseForm.buyer_name}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, buyer_name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            />
            <input
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="Agreed INR / Quintal"
              value={purchaseForm.agreed_price_per_quintal}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, agreed_price_per_quintal: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            />
            <input
              type="text"
              required
              placeholder="Delivery Destination"
              value={purchaseForm.destination}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, destination: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-[#F7FBEF]"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl drishti-gradient text-white text-xs font-bold">
              Confirm Dispatch &amp; Trade Settlement
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
