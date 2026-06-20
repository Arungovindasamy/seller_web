// DashboardLayout.js  (updated — added ReviewSubmitPage routes)
import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { sellerService } from "../../../services/sellerService";
import { getSellerId } from "../../../utils/sellerSession";

import HaatzaNavbar from "../Navbar/Navbar";
import Sidebar from "../Sidebar/Sidebar";
import "./DashboardLayout.css";

// ─── Read the real seller email from auth sources ─────────────────────────────
const resolveSellerEmail = (locationState) => {
  if (locationState?.email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(locationState.email)) {
    const e = locationState.email.trim().toLowerCase();
    console.log("[DashboardLayout] ✅ Email from location.state:", e);
    sessionStorage.setItem("pendingEmail", e);
    localStorage.setItem("userEmail", e);
    return e;
  }

  const sessionKeys = ["pendingEmail", "userEmail", "email", "sellerEmail"];
  for (const key of sessionKeys) {
    const val = sessionStorage.getItem(key);
    if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      const e = val.trim().toLowerCase();
      console.log(`[DashboardLayout] ✅ Email from sessionStorage[${key}]:`, e);
      return e;
    }
  }

  const localKeys = ["userEmail", "email", "sellerEmail",
    "user", "authUser", "currentUser", "seller"];
  for (const key of localKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
      const e = raw.trim().toLowerCase();
      console.log(`[DashboardLayout] ✅ Email from localStorage[${key}]:`, e);
      return e;
    }
    try {
      const parsed = JSON.parse(raw);
      const found = parsed?.email || parsed?.userEmail || parsed?.sellerEmail;
      if (found && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(found)) {
        const e = found.trim().toLowerCase();
        console.log(`[DashboardLayout] ✅ Email from localStorage[${key}].email:`, e);
        return e;
      }
    } catch { /* not JSON */ }
  }

  console.warn("[DashboardLayout] ⚠️ No seller email found in any storage.");
  return "";
};

// ─── Seller display data ───────────────────────────────────────────────────────
const useSellerDisplayData = (resolvedEmail) => {
  const [seller, setSeller] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(resolvedEmail ? true : false);

  useEffect(() => {
    if (!resolvedEmail) {
      setSeller(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    sellerService.getUserProfile(resolvedEmail)
      .then((res) => {
        const rawMsg = res?.message;
        const p = Array.isArray(rawMsg) ? (rawMsg[0] || {}) : (res?.data || res || {});
        const foundSellerId = p.sellerId || p.seller_id || p.uid || p.id;
        if (foundSellerId) {
          const sid = String(foundSellerId).trim();
          localStorage.setItem("sellerId", sid);
          sessionStorage.setItem("sellerId", sid);
          localStorage.setItem("__haatza_sellerId", sid);
          sessionStorage.setItem("__haatza_sellerId", sid);
        }
        setSeller({
          name: p.sellerName || p.companyName || "Seller",
          email: resolvedEmail,
          role: "Seller",
          avatarInitial: (p.sellerName || p.companyName || "Seller")[0].toUpperCase(),
          logoUrl: null,
        });
      })
      .catch((err) => {
        console.warn("[DashboardLayout] getUserProfile failed, using fallback display:", err);
        setSeller({
          name: "Seller",
          email: resolvedEmail,
          role: "Seller",
          avatarInitial: "S",
          logoUrl: null,
        });
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  }, [resolvedEmail]);

  return { seller, loadingProfile };
};

// ─── Main Layout ───────────────────────────────────────────────────────────────
function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const sellerEmail = resolveSellerEmail(location.state);
  const { seller, loadingProfile } = useSellerDisplayData(sellerEmail);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleSidebarToggle = useCallback(() => setSidebarOpen(prev => !prev), []);
  const handleSidebarClose = useCallback(() => { if (isMobile) setSidebarOpen(false); }, [isMobile]);
  const handleCollapseChange = useCallback((collapsed) => setSidebarCollapsed(collapsed), []);

  const activeSellerId = getSellerId();

  if (loadingProfile && !activeSellerId) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100%",
        backgroundColor: "#f5f7ff"
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: "3px solid #e5e7eb",
          borderTopColor: "#2962ff",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!sellerEmail || (!loadingProfile && !activeSellerId)) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f7ff",
        fontFamily: "Inter, sans-serif",
        padding: "24px",
        textAlign: "center"
      }}>
        <div style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "40px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.05)",
          maxWidth: "440px",
          width: "100%"
        }}>
          <div style={{
            color: "#ef4444",
            fontSize: "48px",
            marginBottom: "16px"
          }}>⚠️</div>
          <h2 style={{
            fontSize: "22px",
            fontWeight: "700",
            color: "#1f2937",
            marginBottom: "12px"
          }}>Session Expired</h2>
          <p style={{
            color: "#6b7280",
            fontSize: "14px",
            lineHeight: "1.5",
            marginBottom: "24px"
          }}>Seller session not found. Please login again.</p>
          <button
            onClick={() => navigate("/signin")}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "12px 24px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = "#1d4ed8"}
            onMouseOut={(e) => e.target.style.backgroundColor = "#2563eb"}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "app-container",
        sidebarOpen ? "sidebar-open" : "",
        sidebarCollapsed ? "sidebar-collapsed" : "",
      ].filter(Boolean).join(" ")}
    >
      <HaatzaNavbar seller={seller || {}} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        onToggle={handleSidebarToggle}
        sellerName={seller?.name || ""}
        sellerEmail={seller?.email || sellerEmail || ""}
        onCollapseChange={handleCollapseChange}
        isMobile={isMobile}
      />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;