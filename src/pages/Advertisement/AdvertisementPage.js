import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Plus,
  Play,
  Pause,
  Trash2,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { resolveSellerId } from "../../utils/sellerSession";
import { advertisementService } from "../../services/sellerService";
import "./AdvertisementPage.css";

const AdvertisementPage = () => {
  const sellerId = resolveSellerId();
  const navigate = useNavigate();

  // API Data States
  const [campaigns, setCampaigns] = useState([]);

  // UI Flow States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Toasts
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Load All Data
  const loadPageData = useCallback(async () => {
    if (!sellerId) {
      setError("Seller session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const url = `https://haatza.com/_functions/sellerCampaigns?sellerId=${sellerId}`;
    console.log("[AdvertisementPage] Fetch Campaigns URL:", url);

    try {
      const response = await advertisementService.getCampaigns(sellerId);
      console.log("[AdvertisementPage] Campaigns Response:", response);

      let rawCampaigns = [];
      if (response) {
        if (response.data?.message?.campaigns) {
          rawCampaigns = response.data.message.campaigns;
        } else if (response.message?.campaigns) {
          rawCampaigns = response.message.campaigns;
        } else if (response.data?.campaigns) {
          rawCampaigns = response.data.campaigns;
        } else if (response.campaigns) {
          rawCampaigns = response.campaigns;
        } else if (response.data) {
          rawCampaigns = response.data;
        } else if (Array.isArray(response)) {
          rawCampaigns = response;
        }
      }

      const parsedCampaigns = Array.isArray(rawCampaigns) ? rawCampaigns : [];
      setCampaigns(parsedCampaigns);
    } catch (err) {
      console.error("[AdvertisementPage] Error loading data:", err);
      setError("Failed to load campaigns from backend. Please verify your connection.");
      showToast("Error loading page data", "error");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  // Campaign Status & Action Handlers
  const handlePauseCampaign = async (campaignId) => {
    setActionLoadingId(campaignId);
    try {
      await advertisementService.pauseCampaign(campaignId, sellerId);
      showToast("Campaign paused successfully");
      // Local status update
      setCampaigns(prev =>
        prev.map(c => {
          const id = c.campaignId || c.id || c._id;
          return id === campaignId ? { ...c, status: "Paused" } : c;
        })
      );
    } catch (err) {
      console.error("[AdvertisementPage] Pause campaign failed:", err);
      showToast("Failed to pause campaign", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResumeCampaign = async (campaignId) => {
    setActionLoadingId(campaignId);
    try {
      await advertisementService.resumeCampaign(campaignId, sellerId);
      showToast("Campaign resumed successfully");
      setCampaigns(prev =>
        prev.map(c => {
          const id = c.campaignId || c.id || c._id;
          return id === campaignId ? { ...c, status: "Active" } : c;
        })
      );
    } catch (err) {
      console.error("[AdvertisementPage] Resume campaign failed:", err);
      showToast("Failed to resume campaign", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm("Are you sure you want to delete this campaign?")) return;
    setActionLoadingId(campaignId);
    try {
      await advertisementService.deleteCampaign(campaignId, sellerId);
      showToast("Campaign deleted successfully");
      setCampaigns(prev => {
        return prev.filter(c => {
          const id = c.campaignId || c.id || c._id;
          return id !== campaignId;
        });
      });
    } catch (err) {
      console.error("[AdvertisementPage] Delete campaign failed:", err);
      showToast("Failed to delete campaign", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter campaigns by search query locally
  const filteredCampaigns = useMemo(() => {
    if (!searchQuery.trim()) return campaigns;
    const q = searchQuery.toLowerCase();
    return campaigns.filter(c => {
      const name = String(c.campaignName || c.name || "").toLowerCase();
      const id = String(c.campaignId || c.id || c._id || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [campaigns, searchQuery]);

  // Render Skeleton Placeholders
  const renderSkeletons = () => (
    <div className="ad-skeleton-container">
      <div className="skeleton-main-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="skeleton-right skeleton-pulse" style={{ height: "400px" }} />
      </div>
    </div>
  );

  return (
    <div className="ad-page-root">
      {/* Toast Notification Container */}
      {toast && (
        <div className={`ad-toast-banner ${toast.type}`}>
          <AlertCircle size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Row with actions */}
      <div className="ad-page-header">
        <div className="header-breadcrumbs-area">
          <nav className="ad-breadcrumb">
            <span>Dashboard</span> &gt; <span>Boost Sales</span> &gt; <span className="active">Advertisement</span>
          </nav>
          <h1 className="ad-page-title">Advertisement</h1>
        </div>
        <div className="header-navigation-icons">
          <button className="btn-create-campaign-main" onClick={() => navigate("/advertisement/create-campaign")}>
            <Plus size={16} />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {loading ? (
        renderSkeletons()
      ) : error ? (
        /* Error state with retry */
        <div className="ad-error-container">
          <div className="ad-error-card">
            <AlertCircle size={48} className="error-icon" />
            <h3>Unable to Sync Advertisement Hub</h3>
            <p>{error}</p>
            <button className="btn-retry-sync" onClick={loadPageData}>
              <RefreshCw size={16} />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="ad-main-layout" style={{ display: "block" }}>
          <div className="ad-campaigns-list-card">
            {/* Search Input Bar */}
            <div className="product-search-wrapper" style={{ maxWidth: "400px", marginBottom: "20px" }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search Campaign"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-product-input"
              />
            </div>

            <div className="table-wrapper-horizontal">
              {filteredCampaigns.length === 0 ? (
                <div className="campaigns-empty-view">
                  <TrendingUp size={40} className="empty-chart-icon" />
                  <h4>No Campaigns Found</h4>
                  <p>Drive more traffic to your listings by launching your first campaign today.</p>
                  <button
                    className="btn-create-campaign-inline"
                    onClick={() => navigate("/advertisement/create-campaign")}
                  >
                    New Campaign
                  </button>
                </div>
              ) : (
                <table className="campaigns-desktop-table">
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Campaign ID</th>
                      <th>Campaign Type</th>
                      <th>Status</th>
                      <th>Start Date/Time</th>
                      <th>Budget</th>
                      <th className="align-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((c) => {
                      const id = c.campaignId || c.id || c._id;
                      const statusClass = String(c.status || "active").toLowerCase();
                      const isActionLoading = actionLoadingId === id;

                      return (
                        <tr key={id}>
                          <td>
                            <span className="campaign-name-bold">{c.campaignName || c.name || "Unnamed Campaign"}</span>
                          </td>
                          <td>
                            <span className="campaign-id-cell" style={{ fontFamily: "monospace", color: "#475569" }}>
                              {c.campaignId || c.id || c._id || "N/A"}
                            </span>
                          </td>
                          <td>
                            <span className="campaign-type-pill">{c.campaignType || c.type || "Smart"}</span>
                          </td>
                          <td>
                            <span className={`status-capsule ${statusClass}`}>
                              {c.status || "Active"}
                            </span>
                          </td>
                          <td>
                            <span className="campaign-date-span">
                              {c.startDate ? new Date(c.startDate).toLocaleDateString() : "N/A"}{" "}
                              {c.startTime || ""}
                            </span>
                          </td>
                          <td>
                            <span className="campaign-budget-value">₹{c.dailyBudget || c.budget}</span>
                          </td>
                          <td className="align-right">
                            <div className="campaign-actions-cell">
                              {statusClass === "paused" ? (
                                <button
                                  className="action-pill-btn play"
                                  onClick={() => handleResumeCampaign(id)}
                                  title="Resume Campaign"
                                  disabled={isActionLoading}
                                >
                                  <Play size={14} />
                                </button>
                              ) : (
                                <button
                                  className="action-pill-btn pause"
                                  onClick={() => handlePauseCampaign(id)}
                                  title="Pause Campaign"
                                  disabled={isActionLoading}
                                >
                                  <Pause size={14} />
                                </button>
                              )}
                              <button
                                className="action-pill-btn delete"
                                onClick={() => handleDeleteCampaign(id)}
                                title="Delete Campaign"
                                disabled={isActionLoading}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvertisementPage;
