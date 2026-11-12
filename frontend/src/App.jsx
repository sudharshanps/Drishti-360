import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import DashboardLayout from "./layouts/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CropIntelligencePage from "./pages/CropIntelligencePage";
import LabelCompliancePage from "./pages/LabelCompliancePage";
import FairPriceEnginePage from "./pages/FairPriceEnginePage";
import DigitalPassportPage from "./pages/DigitalPassportPage";
import TraceabilityLedgerPage from "./pages/TraceabilityLedgerPage";
import ReportsAnalyticsPage from "./pages/ReportsAnalyticsPage";
import StakeholderPortalPage from "./pages/StakeholderPortalPage";
import SettingsPage from "./pages/SettingsPage";
import PublicVerifyPage from "./pages/PublicVerifyPage";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify/:passportId" element={<PublicVerifyPage />} />
            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="crop-intelligence" element={<CropIntelligencePage />} />
              <Route path="label-compliance" element={<LabelCompliancePage />} />
              <Route path="fair-price" element={<FairPriceEnginePage />} />
              <Route path="digital-passport" element={<DigitalPassportPage />} />
              <Route path="traceability" element={<TraceabilityLedgerPage />} />
              <Route path="stakeholders" element={<StakeholderPortalPage />} />
              <Route path="reports" element={<ReportsAnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
