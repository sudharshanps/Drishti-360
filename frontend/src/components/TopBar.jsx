import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Globe,
  LogOut,
  Menu,
  RefreshCw,
  UserCircle2,
  Wifi,
  WifiOff,
} from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES } from "../i18n/translations";

export default function TopBar({
  onOpenMobileNav,
  apiConnected,
  isOnline,
  pendingSyncCount = 0,
  syncing = false,
  onSyncNow,
  onNotify,
}) {
  const { user, demoLogin, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();

  const handleRoleSwitch = async (nextRole) => {
    try {
      await demoLogin(nextRole);
      onNotify?.(`Switched active workspace role to ${nextRole.toUpperCase()}`);
      if (nextRole === "fpo" || nextRole === "buyer") {
        navigate(`/app/stakeholders?role=${nextRole}`);
      } else {
        navigate("/app/dashboard");
      }
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#D9F99D] px-4 lg:px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 rounded-xl border border-emerald-200 text-[#14532D]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden">
            <Logo size="sm" showText />
          </div>

          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              apiConnected
                ? "bg-[#ECFCCB] border-[#A3E635] text-[#14532D]"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#228B22]" />
            {apiConnected ? "FastAPI Connected" : "Offline / API Pending"}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isOnline
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-100 border-amber-300 text-amber-900"
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? "Online" : "Offline Capture Mode"}
          </div>

          {pendingSyncCount > 0 && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={!isOnline || syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#14532D] text-[#D9F99D] text-xs font-extrabold hover:bg-[#228B22] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : `Sync Pending (${pendingSyncCount})`}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Role Workspace Switcher */}
          <div className="hidden md:flex items-center bg-[#F7FBEF] border border-emerald-200 rounded-xl p-0.5 text-[11px] font-bold">
            {["farmer", "fpo", "buyer"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleSwitch(r)}
                className={`px-2.5 py-1 rounded-lg uppercase transition ${
                  (user?.role || "farmer") === r
                    ? "bg-[#14532D] text-[#D9F99D]"
                    : "text-[#14532D] hover:bg-[#ECFCCB]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-[#F7FBEF] border border-emerald-200 rounded-xl px-2.5 py-1.5">
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

          <div className="flex items-center gap-2 pl-2 border-l border-emerald-100">
            <UserCircle2 className="w-7 h-7 text-[#228B22]" />
            <div className="hidden lg:block leading-tight">
              <div className="text-xs font-bold text-[#172B1B]">{user?.full_name || "Farmer Workspace"}</div>
              <div className="text-[11px] text-[#228B22] uppercase font-bold">{user?.role || "farmer"}</div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
