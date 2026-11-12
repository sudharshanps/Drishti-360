import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Sparkles, UserPlus } from "lucide-react";
import officialLogo from "../assets/drishti-360-logo.jpg";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function LoginPage() {
  const { login, register, demoLogin, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    location: "Erode, Tamil Nadu",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate("/app/dashboard");
    } catch (err) {
      setError(err.message || "Authentication failed.");
    }
  };

  const handleDemo = async (role = "farmer") => {
    setError("");
    try {
      await demoLogin(role);
      navigate(role === "farmer" ? "/app/dashboard" : `/app/stakeholders?role=${role}`);
    } catch (err) {
      setError(err.message || "Demo login failed.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FBEF] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D] hover:text-[#228B22]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Landing Page
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-card border border-[#D9F99D] p-7">
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src={officialLogo}
            alt="DRISHTI 360 Logo"
            className="w-24 h-24 rounded-full object-cover ring-4 ring-[#A3E635] shadow-md mb-3"
          />
          <h1 className="text-xl font-extrabold text-[#14532D]">DRISHTI 360</h1>
          <p className="text-xs text-[#228B22] font-medium mt-0.5">{t.tagline}</p>
        </div>

        <button
          type="button"
          onClick={() => handleDemo("farmer")}
          disabled={loading}
          className="w-full mb-2.5 py-3 px-4 rounded-2xl drishti-gradient text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-[#D9F99D]" />
          {t.actions.tryDemo} (Farmer)
        </button>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => handleDemo("fpo")}
            disabled={loading}
            className="py-2 px-3 rounded-xl bg-[#ECFCCB] border border-[#A3E635] text-[#14532D] text-xs font-bold hover:bg-[#D9F99D]"
          >
            Demo FPO View
          </button>
          <button
            type="button"
            onClick={() => handleDemo("buyer")}
            disabled={loading}
            className="py-2 px-3 rounded-xl bg-[#ECFCCB] border border-[#A3E635] text-[#14532D] text-xs font-bold hover:bg-[#D9F99D]"
          >
            Demo Buyer View
          </button>
        </div>

        <div className="flex rounded-xl bg-[#F7FBEF] p-1 border border-emerald-100 mb-5">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              mode === "login" ? "bg-[#14532D] text-white" : "text-[#14532D]"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            {t.actions.signIn}
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              mode === "register" ? "bg-[#14532D] text-white" : "text-[#14532D]"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            {t.actions.register}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
              <input
                type="text"
                required
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
              />
            </>
          )}
          <input
            type="email"
            required
            placeholder="Email (demo@drishti360.in)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (drishti2026)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-emerald-200 bg-[#F7FBEF]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#14532D] hover:bg-[#228B22] text-white font-bold text-sm transition"
          >
            {loading ? "Please wait..." : mode === "login" ? t.actions.signIn : t.actions.register}
          </button>
        </form>
      </div>
    </div>
  );
}
