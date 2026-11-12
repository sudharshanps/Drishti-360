import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Globe,
  IndianRupee,
  QrCode,
  ScanEye,
  Sparkles,
} from "lucide-react";
import Logo from "../components/Logo";
import officialLogo from "../assets/drishti-360-logo.jpg";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES } from "../i18n/translations";

export default function LandingPage() {
  const navigate = useNavigate();
  const { demoLogin, loading } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const handleDemo = async () => {
    try {
      await demoLogin();
      navigate("/app/dashboard");
    } catch {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FBEF] text-[#172B1B]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#D9F99D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <Logo size="md" showText subtitle />
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-[#F7FBEF] border border-emerald-200 rounded-xl px-2.5 py-1.5">
              <Globe className="w-4 h-4 text-[#228B22]" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#14532D] focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => navigate("/login")}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[#14532D] border border-[#228B22]/30 hover:bg-[#ECFCCB]"
            >
              {t.actions.signIn}
            </button>
            <button
              onClick={handleDemo}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white drishti-gradient shadow-glow flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#D9F99D]" />
              {t.actions.tryDemo}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D9F99D]/70 border border-[#A3E635] text-xs font-bold text-[#14532D]">
              AI-Powered Farm-to-Market Intelligence Platform
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#14532D] leading-tight">
              Quality, Compliance, Fair Value &amp; Traceability in One Platform
            </h1>
            <p className="text-base text-gray-700 max-w-2xl leading-relaxed">{t.tagline}</p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDemo}
                className="px-6 py-3.5 rounded-2xl text-sm font-bold text-white drishti-gradient shadow-glow flex items-center gap-2"
              >
                Open Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-6 py-3.5 rounded-2xl text-sm font-bold text-[#14532D] bg-white border border-emerald-200 hover:bg-[#ECFCCB]/60"
              >
                Sign In / Register
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {[
                { icon: ScanEye, title: t.nav.cropIntelligence, desc: "Batch creation & visual crop inspection workflow." },
                { icon: FileCheck2, title: t.nav.labelCompliance, desc: "Packaging label declaration verification." },
                { icon: IndianRupee, title: t.nav.fairPrice, desc: "Grade-linked mandi benchmark price estimation." },
                { icon: QrCode, title: t.nav.digitalPassport, desc: "Digital Quality Passport & batch verification." },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.title} className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-card flex gap-3">
                    <div className="p-2.5 rounded-xl bg-[#ECFCCB] text-[#14532D] h-fit">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#14532D]">{m.title}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{m.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-8 border border-[#D9F99D] shadow-card text-center">
              <img
                src={officialLogo}
                alt="DRISHTI 360 Official Logo"
                className="w-44 h-44 rounded-full object-cover ring-4 ring-[#A3E635] mx-auto shadow-md mb-5"
              />
              <h2 className="text-lg font-extrabold text-[#14532D]">DRISHTI 360 Foundation</h2>
              <p className="text-xs text-gray-600 mt-1 mb-5">
                React + Vite + Tailwind + Axios connected to FastAPI + SQLAlchemy
              </p>
              <div className="space-y-2 text-left">
                {[
                  "Batch Registry & REST API Integration",
                  "PostgreSQL-Ready SQLAlchemy Models",
                  "Grade-Linked Pricing & Digital Passport Endpoints",
                  "Chronological Traceability Ledger",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs font-semibold text-[#14532D] bg-[#F7FBEF] px-3 py-2 rounded-xl border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-[#228B22] shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
