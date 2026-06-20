import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  Megaphone,
  PlusCircle,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  Package,
  Settings,
  AlertCircle
} from "lucide-react";
import { getSellerId } from "../../utils/sellerSession";
import { sellerService } from "../../services/sellerService";
import "./DashboardPage.css";

const DashboardPage = () => {
  const sellerId = getSellerId();
  const sellerEmail = localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail") || "";
  const navigate = useNavigate();

  // State for data
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    newOrders: 0,
    confirmedOrders: 0,
    walletBalance: 0,
    unreadNotifications: 0,
    activeCampaigns: 0,
    totalProducts: 0,
    activeProducts: 0,
  });
  const [topProducts, setTopProducts] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchingRef = useRef(false);

  const loadDashboardData = useCallback(async () => {
    if (!sellerId || !sellerEmail) {
      setError("Seller session not found. Please login again.");
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        sellerService.getUserProfile(sellerEmail),
        sellerService.getSellerNewOrders(sellerId),
        sellerService.getSellerConfirmedOrdersCount(sellerId),
        sellerService.checkWalletBalance(sellerId),
        sellerService.getNotifications(sellerId),
        sellerService.getAdvertisementSummary(sellerId),
        sellerService.getTopSellingProducts(sellerId),
        sellerService.getProductStats(sellerId),
        sellerService.getSellerPayments({ email: sellerEmail })
      ]);

      // 1. Profile
      if (results[0].status === "fulfilled") {
        setProfile(results[0].value?.message || results[0].value?.data || results[0].value);
      }

      // 2. New Orders
      let newOrdersVal = 0;
      if (results[1].status === "fulfilled") {
        const rawOrders = results[1].value?.data || results[1].value?.message || results[1].value || [];
        newOrdersVal = Array.isArray(rawOrders) ? rawOrders.filter(o => o.status === "new" || o.status === "pending").length : (results[1].value?.count || 0);
      }

      // 3. Confirmed Orders
      let confirmedVal = 0;
      if (results[2].status === "fulfilled") {
        confirmedVal = results[2].value?.count || results[2].value?.data?.count || results[2].value?.message?.count || 0;
      }

      // 4. Wallet Balance
      let walletBalVal = 0;
      if (results[3].status === "fulfilled") {
        walletBalVal = Number(results[3].value?.message?.RemainingBalance || results[3].value?.RemainingBalance || 0);
      }

      // 5. Notifications count
      let unreadNotifsVal = 0;
      if (results[4].status === "fulfilled") {
        const rawNotif = results[4].value?.message?.data || results[4].value?.data || results[4].value || [];
        unreadNotifsVal = Array.isArray(rawNotif) ? rawNotif.filter(n => !n.read && n.status !== "read").length : 0;
      }

      // 6. Active Campaigns
      let activeCampaignsVal = 0;
      if (results[5].status === "fulfilled") {
        const adSum = results[5].value?.data || results[5].value?.message || results[5].value || {};
        activeCampaignsVal = adSum.activeCampaigns || adSum.ActiveCampaignsCount || 0;
      }

      // 7. Top Selling Products
      if (results[6].status === "fulfilled") {
        const topRaw = results[6].value?.data || results[6].value?.message || results[6].value || [];
        setTopProducts(Array.isArray(topRaw) ? topRaw.slice(0, 5) : []);
      }

      // 8. Product Stats
      let totalProdVal = 0;
      let activeProdVal = 0;
      if (results[7].status === "fulfilled") {
        const pStats = results[7].value?.data || results[7].value?.message || results[7].value || {};
        totalProdVal = pStats.totalProducts || pStats.total || 0;
        activeProdVal = pStats.activeListings || pStats.active || 0;
      }

      // 9. Recent Payments
      if (results[8].status === "fulfilled") {
        const payRaw = results[8].value?.data || results[8].value?.message || results[8].value || [];
        setRecentPayments(Array.isArray(payRaw) ? payRaw.slice(0, 5) : []);
      }

      setStats({
        newOrders: newOrdersVal,
        confirmedOrders: confirmedVal,
        walletBalance: walletBalVal,
        unreadNotifications: unreadNotifsVal,
        activeCampaigns: activeCampaignsVal,
        totalProducts: totalProdVal,
        activeProducts: activeProdVal,
      });

    } catch (err) {
      console.error("[DashboardPage] Fetch data failed:", err);
      setError("Failed to load dashboard statistics. Please verify your connection.");
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [sellerId, sellerEmail]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="dashboard-loading-container">
        <div className="dashboard-loading-spinner" />
        <p>Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error-container">
        <div className="dashboard-error-card">
          <AlertCircle size={40} className="error-icon" />
          <h3>Unable to Load Dashboard</h3>
          <p>{error}</p>
          <button className="btn-retry" onClick={loadDashboardData}>
            <RefreshCw size={14} />
            <span>Retry Load</span>
          </button>
        </div>
      </div>
    );
  }

  const sellerName = profile?.sellerName || profile?.companyName || "Seller";

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-header-section">
        <div>
          <h1 className="dashboard-greeting">Welcome back, {sellerName}! ✨</h1>
          <p className="dashboard-subtitle">Here is what is happening with your store today.</p>
        </div>
        <button className="btn-refresh-dashboard" onClick={loadDashboardData} title="Refresh dashboard data">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="dashboard-kpi-grid">
        {/* Card 1: Orders */}
        <div className="kpi-card" onClick={() => navigate("/orders")}>
          <div className="kpi-icon-wrapper orders-color">
            <ShoppingBag size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-value">{stats.newOrders}</span>
            <span className="kpi-label">New Orders Pending</span>
          </div>
          <ChevronRight size={18} className="kpi-arrow" />
        </div>

        {/* Card 2: Confirmed Orders */}
        <div className="kpi-card" onClick={() => navigate("/orders")}>
          <div className="kpi-icon-wrapper confirmed-color">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-value">{stats.confirmedOrders}</span>
            <span className="kpi-label">Confirmed Orders</span>
          </div>
          <ChevronRight size={18} className="kpi-arrow" />
        </div>

        {/* Card 3: Wallet */}
        <div className="kpi-card" onClick={() => navigate("/wallet")}>
          <div className="kpi-icon-wrapper wallet-color">
            <Wallet size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-value">₹{stats.walletBalance.toFixed(2)}</span>
            <span className="kpi-label">Wallet Balance</span>
          </div>
          <ChevronRight size={18} className="kpi-arrow" />
        </div>

        {/* Card 4: Campaigns */}
        <div className="kpi-card" onClick={() => navigate("/advertisement")}>
          <div className="kpi-icon-wrapper campaign-color">
            <Megaphone size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-value">{stats.activeCampaigns}</span>
            <span className="kpi-label">Active Campaigns</span>
          </div>
          <ChevronRight size={18} className="kpi-arrow" />
        </div>
      </div>

      {/* Secondary layout sections */}
      <div className="dashboard-content-layout">
        {/* Left Column: Stats & Products */}
        <div className="dashboard-column-main">
          {/* Product listings stats */}
          <div className="dashboard-section-card">
            <h3>Inventory & Listings Summary</h3>
            <div className="prod-summary-grid">
              <div className="summary-item">
                <Package size={20} className="text-blue" />
                <div>
                  <span className="summary-num">{stats.totalProducts}</span>
                  <span className="summary-lbl">Total Products</span>
                </div>
              </div>
              <div className="summary-item">
                <PlusCircle size={20} className="text-green" />
                <div>
                  <span className="summary-num">{stats.activeProducts}</span>
                  <span className="summary-lbl">Active Listings</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="dashboard-section-card">
            <h3>Top Selling Products</h3>
            {topProducts.length === 0 ? (
              <div className="dashboard-empty-substate">
                <Package size={28} />
                <p>No sales records found for this period.</p>
              </div>
            ) : (
              <div className="top-products-list">
                {topProducts.map((p, idx) => (
                  <div key={p.id || p._id || idx} className="top-product-row">
                    <span className="product-rank">#{idx + 1}</span>
                    <div className="product-info-wrap">
                      <span className="product-row-name">{p.name || p.productName || p.title}</span>
                      <span className="product-row-sales">{p.salesCount || p.sales || 0} items sold</span>
                    </div>
                    <span className="product-row-revenue">₹{Number(p.revenue || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Actions & Settlements */}
        <div className="dashboard-column-side">
          {/* Quick Actions */}
          <div className="dashboard-section-card">
            <h3>Quick Actions</h3>
            <div className="quick-actions-list">
              <button className="btn-action-row" onClick={() => navigate("/listing/select-category")}>
                <PlusCircle size={16} />
                <span>Create New Product Listing</span>
              </button>
              <button className="btn-action-row" onClick={() => navigate("/advertisement/create-campaign")}>
                <Megaphone size={16} />
                <span>Launch Advertising Campaign</span>
              </button>
              <button className="btn-action-row" onClick={() => navigate("/help")}>
                <HelpCircle size={16} />
                <span>Open Support Ticket</span>
              </button>
              <button className="btn-action-row" onClick={() => navigate("/settings")}>
                <Settings size={16} />
                <span>Update Store Settings</span>
              </button>
            </div>
          </div>

          {/* Recent Payouts */}
          <div className="dashboard-section-card">
            <h3>Recent Settlements</h3>
            {recentPayments.length === 0 ? (
              <div className="dashboard-empty-substate">
                <Wallet size={28} />
                <p>No recent payout details found.</p>
              </div>
            ) : (
              <div className="recent-payouts-list">
                {recentPayments.map((pay, idx) => (
                  <div key={pay.id || pay._id || idx} className="payout-row">
                    <div>
                      <span className="payout-date">{pay.date || "Recent"}</span>
                      <span className="payout-status-badge">{pay.status || "Completed"}</span>
                    </div>
                    <span className="payout-amount">₹{Number(pay.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
