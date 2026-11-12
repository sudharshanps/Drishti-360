import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ScanEye,
  FileCheck2,
  IndianRupee,
  QrCode,
  GitBranch,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Logo from "./Logo";
import { useLanguage } from "../context/LanguageContext";

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { t } = useLanguage();

  const navItems = [
    { to: "/app/dashboard", label: t.nav.overview, icon: LayoutDashboard },
    { to: "/app/crop-intelligence", label: t.nav.cropIntelligence, icon: ScanEye },
    { to: "/app/label-compliance", label: t.nav.labelCompliance, icon: FileCheck2 },
    { to: "/app/fair-price", label: t.nav.fairPrice, icon: IndianRupee, flagship: true },
    { to: "/app/digital-passport", label: t.nav.digitalPassport, icon: QrCode, flagship: true },
    { to: "/app/traceability", label: t.nav.traceability, icon: GitBranch },
    { to: "/app/stakeholders", label: "FPO & Buyer Hub", icon: Users },
    { to: "/app/reports", label: t.nav.reports, icon: BarChart3 },
    { to: "/app/settings", label: t.nav.settings || "Settings", icon: Settings },
  ];

  const content = (
    <div className="flex flex-col h-full bg-[#14532D] text-white">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <Logo size="sm" showText={!collapsed} subtitle={!collapsed} lightText />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:inline-flex p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#D9F99D] transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg bg-white/10 text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[#228B22] to-[#A3E635]/90 text-[#172B1B] font-bold shadow-md"
                    : item.flagship
                    ? "bg-white/5 text-white hover:bg-white/15 border border-[#A3E635]/25"
                    : "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate flex-1">{item.label}</span>}
              {!collapsed && item.flagship && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#A3E635] text-[#14532D] text-[9px] font-extrabold uppercase tracking-wider shrink-0">
                  Flagship
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <aside
        className="hidden lg:block shrink-0 transition-all duration-300"
        style={{ width: collapsed ? "5rem" : "16.5rem" }}
      >
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{content}</div>
        </div>
      )}
    </>
  );
}
