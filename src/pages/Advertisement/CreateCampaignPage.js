import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Wallet,
  Bell,
  Check,
  AlertCircle,
  Plus,
  RefreshCw,
  Clock,
  Calendar,
  Search,
  Package
} from "lucide-react";
import { resolveSellerId } from "../../utils/sellerSession";
import {
  advertisementService,
  checkWalletBalance,
  resolveWixImage
} from "../../services/sellerService";
import "./CreateCampaignPage.css";

// Date-Time formatting helper matching Flutter style (D/M/YYYY h:mm A)
const getFormattedDateTime = () => {
  const now = new Date();
  const datePart = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${datePart} ${hours}:${minutesStr} ${ampm}`;
};

const CreateCampaignPage = () => {
  const sellerId = resolveSellerId();
  const navigate = useNavigate();

  // Wizard Step State
  const [step, setStep] = useState(1); // 1: Details, 2: Choose Products

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // --- Step 1 Form Fields ---
  const [campaignType, setCampaignType] = useState("Smart"); // Smart is recommended / default
  const [campaignName, setCampaignName] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("22:00");
  const [cpcGoal, setCpcGoal] = useState("");
  const [selectedBudgetMode, setSelectedBudgetMode] = useState("preset"); // 'preset' | 'manual'
  const [selectedBudgetOption, setSelectedBudgetOption] = useState("250");
  const [manualBudget, setManualBudget] = useState("");

  // --- Step 2 Products Selection ---
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Load Wallet Balance & Set Default Campaign Name
  const loadInitialData = useCallback(async () => {
    if (!sellerId) {
      setError("Seller session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Wallet balance fetch
      const walletRes = await checkWalletBalance(sellerId);
      console.log("[AdvertisementPage] Wallet Balance Response:", walletRes);
      
      const balance = walletRes?.data?.RemainingBalance || walletRes?.message?.RemainingBalance || walletRes?.RemainingBalance || 0;
      setWalletBalance(Number(balance));

      // Generate default campaign name
      const defaultName = `New Smart Campaign ${getFormattedDateTime()}`;
      setCampaignName(defaultName);
    } catch (err) {
      console.warn("Failed fetching wallet details, defaulting balance to 0:", err);
      // Fallback balance to 0 on error, do not block creation
      setWalletBalance(0);
      setCampaignName(`New Smart Campaign ${getFormattedDateTime()}`);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Products for Step 2
  const loadProducts = useCallback(async () => {
    if (!sellerId || step !== 2) return;
    setProductsLoading(true);
    setProductsError(null);

    const url = `https://haatza.com/_functions/sellerCampaignsproducts?sellerId=${sellerId}&page=1&limit=30&search=${encodeURIComponent(searchText)}`;
    console.log("[AdvertisementPage] Fetch Products URL:", url);

    try {
      const response = await advertisementService.fetchSellerCampaignProduct(sellerId, 1, searchText);
      console.log("[AdvertisementPage] Campaign Products Response:", response);

      const itemsRaw = response?.data || response?.products || response?.items || response || [];
      const items = Array.isArray(itemsRaw) ? itemsRaw : [];
      setProducts(items);
    } catch (err) {
      console.error("[CreateCampaignPage] Products fetch failed:", err);
      setProductsError("Unable to load products. Please check connection.");
      showToast("Error loading products", "error");
    } finally {
      setProductsLoading(false);
    }
  }, [sellerId, step, searchText]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Daily Budget resolver
  const dailyBudget = useMemo(() => {
    if (selectedBudgetMode === "preset") {
      return Number(selectedBudgetOption);
    }
    return Number(manualBudget);
  }, [selectedBudgetMode, selectedBudgetOption, manualBudget]);

  // Validations for Step 1
  const validateStep1 = () => {
    const errors = {};
    if (!campaignName.trim()) {
      errors.name = "Campaign name is required.";
    } else if (campaignName.length > 40) {
      errors.name = "Campaign name cannot exceed 40 characters.";
    }

    if (!startDate) errors.startDate = "Start date is required.";
    if (!startTime) errors.startTime = "Start time is required.";

    if (selectedBudgetMode === "manual") {
      if (!manualBudget) {
        errors.budget = "Daily budget is required.";
      } else {
        const num = Number(manualBudget);
        if (isNaN(num) || num <= 0) {
          errors.budget = "Daily budget must be a number greater than 0.";
        }
      }
    } else {
      if (!selectedBudgetOption) {
        errors.budget = "Please select a budget option.";
      }
    }

    if (hasEndDate) {
      if (!endDate) {
        errors.endDate = "End date is required.";
      } else {
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);
        if (end < start) {
          errors.endDate = "End date cannot be before start date.";
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Continue Handler (Proceed to Step 2)
  const handleContinue = (e) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    } else {
      showToast("Please correct the validation errors.", "error");
    }
  };

  // Final Submit Handler (Create Campaign)
  const handleFinalSubmit = async () => {
    if (selectedProductIds.length === 0) {
      showToast("At least one product must be selected.", "error");
      return;
    }

    setSubmitting(true);
    const payload = {
      sellerId,
      campaignName: campaignName.trim(),
      campaignType: "Smart",
      startDate,
      startTime,
      endDate: hasEndDate ? endDate : "",
      cpcGoal: cpcGoal || "",
      dailyBudget: Number(dailyBudget),
      selectedProducts: selectedProductIds,
      status: "Active"
    };

    console.log("[AdvertisementPage] New Campaign Payload:", payload);

    try {
      const response = await advertisementService.createCampaign(payload);
      console.log("[AdvertisementPage] New Campaign Response:", response);

      showToast("Campaign created successfully!");
      setTimeout(() => {
        navigate("/advertisement");
      }, 1500);
    } catch (err) {
      console.error("[CreateCampaignPage] Submission failed:", err);
      const msg = err.response?.data?.message || err.message || "Failed to create campaign.";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Select All Checkbox
  const handleSelectAllChange = (e) => {
    if (e.target.checked) {
      const allIds = products.map(p => p.productId || p.id || p._id || p.Table_ID).filter(Boolean);
      setSelectedProductIds(allIds);
    } else {
      setSelectedProductIds([]);
    }
  };

  // Handle Individual Product Checkbox
  const handleProductSelectChange = (productId, isChecked) => {
    if (isChecked) {
      setSelectedProductIds(prev => [...prev, productId]);
    } else {
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
    }
  };

  // Render Skeleton Loader
  const renderSkeletons = () => (
    <div className="cc-skeleton-layout">
      <div className="skeleton-form-card skeleton-pulse" style={{ height: "400px", borderRadius: "14px", background: "#cbd5e1" }} />
    </div>
  );

  return (
    <div className="cc-page-root">
      {toast && (
        <div className={`cc-toast-banner ${toast.type}`}>
          <AlertCircle size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Breadcrumbs and Header Area */}
      <div className="cc-page-header">
        <div className="cc-header-left">
          <button className="back-arrow-btn" onClick={() => {
            if (step === 2) {
              setStep(1);
            } else {
              navigate("/advertisement");
            }
          }} aria-label="Go Back">
            <ChevronLeft size={24} />
          </button>
          <div>
            <nav className="cc-breadcrumb">
              <span>Advertisement</span> &gt; <span className="active">New Campaign</span>
            </nav>
            <h1 className="cc-page-title">
              {step === 1 ? "Create New Campaign" : "Choose the Products"}
            </h1>
          </div>
        </div>
        <div className="cc-header-right">
          <button className="nav-icon-btn" onClick={() => navigate("/wallet")} aria-label="Wallet">
            <Wallet size={20} />
          </button>
          <button className="nav-icon-btn" onClick={() => navigate("/notifications")} aria-label="Notifications">
            <Bell size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        renderSkeletons()
      ) : error ? (
        <div className="cc-error-container">
          <div className="cc-error-card">
            <AlertCircle size={48} className="error-icon" />
            <h3>Configuration Error</h3>
            <p>{error}</p>
            <button className="btn-retry-sync" onClick={loadInitialData}>
              <RefreshCw size={16} />
              <span>Retry Load</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="cc-form-layout">
          {step === 1 ? (
            /* =================================================================
               STEP 1: Campaign Details Form
               ================================================================= */
            <form onSubmit={handleContinue} className="cc-grid-main">
              <div className="cc-fields-card">
                {/* 1. Select Campaign Type */}
                <div className="form-group-section">
                  <label className="section-label-main">Campaign Type</label>
                  <div className="type-selection-cards">
                    {/* Smart Campaign */}
                    <div
                      className={`type-card ${campaignType === "Smart" ? "selected" : ""}`}
                      onClick={() => setCampaignType("Smart")}
                    >
                      <div className="type-card-header">
                        <span className="type-title">Smart Campaign</span>
                        <div className="type-badges">
                          <span className="badge-recommended">Recommended</span>
                        </div>
                      </div>
                      <p className="type-description">
                        You choose the Products manually, and we optimize the performance.
                      </p>
                      {campaignType === "Smart" && (
                        <div className="selected-check-bubble">
                          <Check size={14} />
                        </div>
                      )}
                    </div>

                    {/* Manual Campaign (Disabled) */}
                    <div className="type-card unavailable">
                      <div className="type-card-header">
                        <span className="type-title" style={{ color: "#94a3b8" }}>Manual Campaign</span>
                        <div className="type-badges">
                          <span className="badge-unavailable">Currently unavailable</span>
                        </div>
                      </div>
                      <p className="type-description">
                        Define budgets and bid strategies at product level manually.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Campaign Name */}
                <div className="form-group-section">
                  <label className="section-label-main">Campaign Name</label>
                  <div className="input-with-counter">
                    <input
                      type="text"
                      placeholder="Enter campaign name"
                      value={campaignName}
                      onChange={(e) => {
                        setCampaignName(e.target.value);
                        if (validationErrors.name) {
                          setValidationErrors(prev => ({ ...prev, name: null }));
                        }
                      }}
                      className={`text-input ${validationErrors.name ? "error" : ""}`}
                      maxLength={40}
                    />
                    <span className="char-counter">{campaignName.length}/40</span>
                  </div>
                  {validationErrors.name && <span className="field-error-text">{validationErrors.name}</span>}
                </div>

                {/* Smart Campaign Bullet points list */}
                <div className="smart-campaign-info-section" style={{ background: "#f8fafc", padding: "20px", borderRadius: "10px", marginBottom: "28px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#1e293b" }}>
                      <Check size={16} className="text-success" style={{ color: "#10b981" }} />
                      <span>Sellers with Smart Campaign get 20% higher orders</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#1e293b" }}>
                      <Check size={16} className="text-success" style={{ color: "#10b981" }} />
                      <span>10,000+ Sellers have created Smart Campaign</span>
                    </div>
                  </div>

                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569" }}>Catalogs</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <Package size={20} style={{ color: "#2962ff", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "13.5px", color: "#1e293b" }}>Automatically selects catalogs customers love</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>Catalogs will be visible after creation</div>
                        <div style={{ fontSize: "12px", color: "#10b981", fontWeight: "600", marginTop: "2px" }}>Pause catalogs anytime</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f4ff", color: "#2962ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>🔄</div>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "13.5px", color: "#1e293b" }}>Pauses poor performing catalogs to give better ROI</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f4ff", color: "#2962ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>📈</div>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "13.5px", color: "#1e293b" }}>Bids smartly to get more clicks than competitors</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Duration selectors */}
                <div className="form-group-section">
                  <label className="section-label-main">Select Duration</label>
                  <div className="duration-inputs-row">
                    <div className="date-time-box">
                      <span className="sub-label">Start Date</span>
                      <div className="icon-input-wrap">
                        <Calendar size={16} className="input-icon" />
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            if (validationErrors.startDate) {
                              setValidationErrors(prev => ({ ...prev, startDate: null }));
                            }
                          }}
                          className={`date-input ${validationErrors.startDate ? "error" : ""}`}
                        />
                      </div>
                    </div>
                    <div className="date-time-box">
                      <span className="sub-label">Start Time</span>
                      <div className="icon-input-wrap">
                        <Clock size={16} className="input-icon" />
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            if (validationErrors.startTime) {
                              setValidationErrors(prev => ({ ...prev, startTime: null }));
                            }
                          }}
                          className={`date-input ${validationErrors.startTime ? "error" : ""}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="checkbox-wrap" style={{ margin: "14px 0" }}>
                    <input
                      type="checkbox"
                      id="setEndDateCheckbox"
                      checked={hasEndDate}
                      onChange={(e) => {
                        setHasEndDate(e.target.checked);
                        if (e.target.checked && !endDate) {
                          setEndDate(startDate);
                        }
                        setValidationErrors(prev => ({ ...prev, endDate: null }));
                      }}
                    />
                    <label htmlFor="setEndDateCheckbox">Set an End Date</label>
                  </div>

                  {hasEndDate && (
                    <div className="duration-inputs-row ending-row">
                      <div className="date-time-box">
                        <span className="sub-label">End Date</span>
                        <div className="icon-input-wrap">
                          <Calendar size={16} className="input-icon" />
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                              setEndDate(e.target.value);
                              setValidationErrors(prev => ({ ...prev, endDate: null }));
                            }}
                            className={`date-input ${validationErrors.endDate ? "error" : ""}`}
                          />
                        </div>
                      </div>
                      <div className="date-time-box">
                        <span className="sub-label">End Time</span>
                        <div className="icon-input-wrap">
                          <Clock size={16} className="input-icon" />
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="date-input"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {validationErrors.endDate && <span className="field-error-text">{validationErrors.endDate}</span>}
                </div>

                {/* 4. CPC Goal */}
                <div className="form-group-section">
                  <div className="label-with-tip">
                    <label className="section-label-main">CPC Goal (Optional)</label>
                    <span className="field-tip">Set your target cost per click.</span>
                  </div>
                  <div className="cpc-input-wrapper">
                    <span className="currency-prefix">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Set your target cost per click."
                      value={cpcGoal}
                      onChange={(e) => setCpcGoal(e.target.value)}
                      className="cpc-input"
                    />
                  </div>
                  <p className="cpc-instructions">
                    Haatza will aim to get more clicks at or below this amount. Leave blank for maximum reach.
                  </p>
                </div>

                {/* 5. Daily Budget selector */}
                <div className="form-group-section">
                  <label className="section-label-main">Daily Budget</label>
                  <div className="budget-modes-selectors">
                    {/* Mode A: Preset option selection */}
                    <div
                      className={`budget-mode-card ${selectedBudgetMode === "preset" ? "active" : ""}`}
                      onClick={() => {
                        setSelectedBudgetMode("preset");
                        if (validationErrors.budget) {
                          setValidationErrors(prev => ({ ...prev, budget: null }));
                        }
                      }}
                    >
                      <div className="radio-check-row">
                        <div className={`radio-circle ${selectedBudgetMode === "preset" ? "checked" : ""}`}>
                          {selectedBudgetMode === "preset" && <div className="radio-dot" />}
                        </div>
                        <span>Select a budget option</span>
                      </div>

                      <div className="preset-budget-options">
                        {["250", "550", "700"].map((opt) => {
                          const isPresetSelected = selectedBudgetOption === opt && selectedBudgetMode === "preset";
                          return (
                            <button
                              key={opt}
                              type="button"
                              className={`preset-btn ${isPresetSelected ? "selected" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBudgetMode("preset");
                                setSelectedBudgetOption(opt);
                                setManualBudget("");
                                if (validationErrors.budget) {
                                  setValidationErrors(prev => ({ ...prev, budget: null }));
                                }
                              }}
                            >
                              {isPresetSelected && <Check size={12} className="check-icon" />}
                              <span>₹{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mode B: Manual selection */}
                    <div
                      className={`budget-mode-card ${selectedBudgetMode === "manual" ? "active" : ""}`}
                      onClick={() => {
                        setSelectedBudgetMode("manual");
                        if (validationErrors.budget) {
                          setValidationErrors(prev => ({ ...prev, budget: null }));
                        }
                      }}
                    >
                      <div className="radio-check-row">
                        <div className={`radio-circle ${selectedBudgetMode === "manual" ? "checked" : ""}`}>
                          {selectedBudgetMode === "manual" && <div className="radio-dot" />}
                        </div>
                        <span>Select budget manually</span>
                      </div>

                      {selectedBudgetMode === "manual" && (
                        <div className="manual-budget-input-wrap">
                          <span className="currency-prefix">₹</span>
                          <input
                            type="number"
                            placeholder="Enter daily limit"
                            value={manualBudget}
                            onChange={(e) => {
                              setManualBudget(e.target.value);
                              if (validationErrors.budget) {
                                setValidationErrors(prev => ({ ...prev, budget: null }));
                              }
                            }}
                            className="manual-input"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {validationErrors.budget && <span className="field-error-text">{validationErrors.budget}</span>}
                  <p className="cpc-instructions warning-note" style={{ marginTop: "14px" }}>
                    Your catalogs lose over 10k+ customer searches as daily budget gets over.
                  </p>
                </div>
              </div>

              {/* Right Summary Sidebar Panel */}
              <div className="cc-summary-card">
                <h3>Campaign Launch Control</h3>
                
                <div className="summary-details-list">
                  <div className="summary-item">
                    <span className="sum-label">Campaign Type:</span>
                    <span className="sum-val">{campaignType} Campaign</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Daily Budget:</span>
                    <span className="sum-val text-primary">₹{dailyBudget}</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Duration:</span>
                    <span className="sum-val">
                      {startDate} {hasEndDate ? `to ${endDate}` : "(Ongoing)"}
                    </span>
                  </div>
                </div>

                <div className="wallet-balance-callout">
                  <div className="balance-labels">
                    <span className="lbl">Current Balance</span>
                    <span className="val">₹{walletBalance.toFixed(2)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-add-funds-cc"
                    onClick={() => navigate("/wallet")}
                  >
                    <Plus size={14} />
                    <span>Add Funds</span>
                  </button>
                </div>

                <button type="submit" className="btn-launch-campaign">
                  <span>Continue</span>
                </button>
              </div>
            </form>
          ) : (
            /* =================================================================
               STEP 2: Choose Products
               ================================================================= */
            <div className="cc-grid-main" style={{ gridTemplateColumns: "1fr 340px" }}>
              <div className="cc-fields-card">
                {/* Search Bar top row */}
                <div className="product-search-wrapper" style={{ marginBottom: "20px" }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by Product Name"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="search-product-input"
                  />
                </div>

                {productsLoading ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <RefreshCw size={32} className="spinner-icon" style={{ color: "#2962ff" }} />
                    <p style={{ marginTop: "12px", color: "#64748b" }}>Loading products catalog...</p>
                  </div>
                ) : productsError ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>
                    <AlertCircle size={32} />
                    <p style={{ marginTop: "12px" }}>{productsError}</p>
                    <button className="preset-btn" style={{ margin: "10px auto 0" }} onClick={loadProducts}>
                      Retry fetch
                    </button>
                  </div>
                ) : products.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    <Package size={32} />
                    <p style={{ marginTop: "12px" }}>No products found in inventory.</p>
                  </div>
                ) : (
                  <div className="table-wrapper-horizontal">
                    <table className="campaigns-desktop-table products-selection-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>
                            <input
                              type="checkbox"
                              checked={products.length > 0 && selectedProductIds.length === products.length}
                              onChange={handleSelectAllChange}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                          </th>
                          <th style={{ width: "60px" }}>Image</th>
                          <th>Product Name</th>
                          <th>Price</th>
                          <th>Status / Availability</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => {
                          const id = p.productId || p.id || p._id || p.Table_ID;
                          const name = p.name || p.productName || p.title || "Unnamed Product";
                          const price = p.price || p.salePrice || 0;
                          const imageUrl = resolveWixImage(p.mainmedia || p.imageUrl || p.image || p.thumbnail);
                          const status = p.status || (p.totalQuantity > 0 ? "In Stock" : "Out of Stock");
                          const isChecked = selectedProductIds.includes(id);

                          return (
                            <tr key={id} className={isChecked ? "product-row-selected" : ""}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => handleProductSelectChange(id, e.target.checked)}
                                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                />
                              </td>
                              <td>
                                <div className="product-img-holder" style={{ width: "40px", height: "40px" }}>
                                  {imageUrl ? (
                                    <img src={imageUrl} alt={name} />
                                  ) : (
                                    <Package size={20} className="img-placeholder" />
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span className="campaign-name-bold">{name}</span>
                                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>SKU: {p.sku || "N/A"}</span>
                                </div>
                              </td>
                              <td>
                                <span className="campaign-budget-value">₹{price}</span>
                              </td>
                              <td>
                                <span className={`status-capsule ${String(status).toLowerCase().includes("out") ? "inactive" : "active"}`}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right sticky launch sidebar panel */}
              <div className="cc-summary-card">
                <h3>Launch Campaign</h3>
                
                <div className="summary-details-list">
                  <div className="summary-item">
                    <span className="sum-label">Campaign Name:</span>
                    <span className="sum-val">{campaignName}</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Selected Products:</span>
                    <span className="sum-val text-primary" style={{ fontSize: "16px" }}>{selectedProductIds.length} Products</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Daily Budget:</span>
                    <span className="sum-val">₹{dailyBudget}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="preset-btn"
                    style={{ flex: 1, justifyContent: "center", background: "#fff", border: "1px solid #cbd5e1" }}
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-launch-campaign"
                    style={{ flex: 2 }}
                    onClick={handleFinalSubmit}
                    disabled={submitting || selectedProductIds.length === 0}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="spinner-icon" />
                        <span>Launching...</span>
                      </>
                    ) : (
                      <span>Submit</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreateCampaignPage;
