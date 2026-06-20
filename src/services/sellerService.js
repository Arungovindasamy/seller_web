import axios from "axios";
import { resolveSellerId as sessionResolveSellerId, getSellerId as sessionGetSellerId, resolveSellerEmail } from "../utils/sellerSession";

export const resolveSellerId = sessionResolveSellerId;
const getSellerId = sessionGetSellerId;
export const resolveSellerEmailForApi = resolveSellerEmail;

// Safely check environment for both Vite and Webpack/CRA compatibility
const checkDev = () => {
  try {
    // eslint-disable-next-line no-new-func
    const meta = new Function("return import.meta")();
    if (meta && meta.env && meta.env.DEV !== undefined) {
      return meta.env.DEV;
    }
  } catch { }
  try {
    if (process.env && process.env.NODE_ENV === "development") {
      return true;
    }
  } catch { }
  return typeof window !== "undefined" && window.location.hostname === "localhost";
};

//const HAATZA_BASE = "https://haatza.com/_functions";
const _svcLog = (...a) => { try { if (checkDev()) console.log(...a); } catch { } };
const _svcErr = (...a) => { try { if (checkDev()) console.error(...a); } catch { } };

const HAATZA_BASE = "https://haatza.com/_functions";
const HAATZA_SELLER_BASE = "https://haatzaseller.com/_functions";

const proxyExists = false;
const HAATZA_FUNCTIONS_BASE = checkDev() && proxyExists ? "/api/_functions" : "https://haatza.com/_functions";
const API_BASE_URL = HAATZA_FUNCTIONS_BASE;

const BASE_URL = HAATZA_BASE;
const BASE_URL_WWW = HAATZA_BASE;
const PROFILE_BASE_URL = HAATZA_SELLER_BASE;
const ONBOARD_STATUS_API_URL = `${HAATZA_SELLER_BASE}/onboardStatus`;
const GST_API_URL = `${HAATZA_SELLER_BASE}/checksellergst`;
const CATEGORY_API = `${HAATZA_BASE}/category`;
const SELLER_BASE_URL = HAATZA_SELLER_BASE;

// ─── SELLER SERVICE API ENDPOINTS ────────────────────────────────────────────
const SELLER_PRODUCT_INVENTORY_API = `${API_BASE_URL}/sellerproductInventory`;
const INCREMENT_INVENTORY_API = `${API_BASE_URL}/incrementInventory`;
const DECREMENT_INVENTORY_API = `${API_BASE_URL}/decrementInventory`;
const CHECK_WALLET_BALANCE_API = `${API_BASE_URL}/checkWalletBalance`;
const TRANSACTION_HISTORY_API = `${API_BASE_URL}/transactionHistory`;
const ADD_FUNDS_API = `${API_BASE_URL}/addFunds`;
const NOTIFICATIONS_API = `${API_BASE_URL}/notifications`;
const UPDATE_NOTIFICATION_API = `${API_BASE_URL}/updateNotification`;



const SELLER_CAMPAIGNS_API = `${API_BASE_URL}/sellerCampaigns`;
const NEW_SELLER_CAMPAIGN_API = `${API_BASE_URL}/newSellerCampaign`;
const OFF_SELLER_CAMPAIGN_API = `${API_BASE_URL}/offSellerCampaign`;
const UPDATE_SELLER_CAMPAIGN_API = `${API_BASE_URL}/updateSellerCampaign`;
const DELETE_SELLER_CAMPAIGN_API = `${API_BASE_URL}/deleteSellerCampaign`;
const CAMPAIGN_SUMMARY_API = `${API_BASE_URL}/Campaignsummery`;
const CAMPAIGN_DETAILS_API = `${API_BASE_URL}/campaignDetails`;

// ─── Status constants — must match exactly what is saved in DB ────────────────
export const IN_PROGRESS_STATUSES = ["Draft", "Under Review", "Pending", "Rejected", "Approved", "Update_Requested"];


/* =============================================================================
  INTERNAL HELPER FUNCTIONS
  ============================================================================= */

// Centralized resolveSellerId is imported from sellerSession

const getOrResolveSellerId = (sellerId) => {
  const resolved = (sellerId || resolveSellerId() || "").trim();
  if (!resolved || resolved === "null" || resolved === "undefined") {
    throw new Error("Seller session not found. Please login again.");
  }
  return resolved;
};

// categoryApi extraction helper
const extractArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const KEYS = [
    "items", "data", "results", "message",
    "subCategories", "subcategories", "categories",
  ];

  for (const k of KEYS) {
    const val = payload[k];
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const inner = extractArray(val);
      if (inner.length > 0) return inner;
    }
  }

  const firstArr = Object.values(payload).find(Array.isArray);
  return firstArr || [];
};

// categoryApi image resolution helper
const resolveImageUrl = (rawImg) => {
  if (!rawImg) return null;

  if (typeof rawImg === "object" && !Array.isArray(rawImg)) {
    const src =
      rawImg.url || rawImg.src || rawImg.imageUrl ||
      rawImg.uri || rawImg.value || rawImg.mediaUrl ||
      rawImg.filePath || null;
    return resolveImageUrl(src);
  }

  if (typeof rawImg !== "string") return null;

  const trimmed = rawImg.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("wix:image://")) {
    const noScheme = trimmed.replace(/^wix:image:\/\/(?:v1\/)?/, "");
    const [fileIdRaw, ...rest] = noScheme.split("/");
    const fileId = fileIdRaw.split("#")[0].split("?")[0];
    if (!fileId) return null;

    const displayName = rest.length
      ? rest.join("/").split("#")[0].split("?")[0]
      : "image.jpg";

    return `https://static.wixstatic.com/media/${fileId}/v1/fill/w_300,h_300,al_c,q_85,usm_0.66_1.00_0.01/${displayName}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.length > 4 && !trimmed.includes(" ")) {
    return `https://static.wixstatic.com/media/${trimmed}`;
  }

  return null;
};

// categoryApi scan keys helper
const findImageInItem = (item) => {
  const KNOWN = [
    "subCategoryImage", "subCategoryImg",
    "SubCategoryImage", "SubCategoryImg",
    "categoryImage", "categoryImg",
    "CategoryImage", "CategoryImg",
    "image", "imageUrl",
    "ImageUrl", "img",
    "thumbnail", "photo",
    "icon", "coverImage",
    "bannerImage", "mediaUrl",
    "pictureUrl", "picture",
    "logo", "logoUrl",
  ];

  for (const key of KNOWN) {
    if (item[key]) {
      const resolved = resolveImageUrl(item[key]);
      if (resolved) return resolved;
    }
  }

  for (const [key, val] of Object.entries(item)) {
    if (!val) continue;
    const isImageKey = /image|img|photo|thumb|icon|logo|media|picture|banner|cover/i.test(key);
    if (!isImageKey) continue;
    const resolved = resolveImageUrl(val);
    if (resolved) return resolved;
  }

  return null;
};

// categoryApi normalise category
const normaliseCategory = (item, index) => {
  const name =
    item.categoryName || item.CategoryName ||
    item.name || item.title || "Unnamed";

  const id =
    item.categoryId || item.CategoryID ||
    item.CategoryId || item._id ||
    item.id || `cat-${index}`;

  const imageUrl = findImageInItem(item);

  return {
    uniqueKey: `${id}-${index}`,
    ...item,
    name,
    CategoryID: String(id),
    imageUrl,
  };
};

// categoryApi normalise subcategory
const normaliseSubcategory = (item, index) => {
  const name =
    item.subCategoryName || item.SubCategoryName ||
    item.subCategory || item.SubCategory ||
    item.name || item.title || "Unnamed";

  const id =
    item.subCategoryId || item.SubCategoryID ||
    item.subCategoryID || item._id ||
    item.id || `sub-${index}`;

  const imageUrl = findImageInItem(item);

  const resolvedCategoryName =
    item.categoryName ||
    item.CategoryName ||
    item.category_name ||
    item.parentCategory ||
    item.parentCategoryName ||
    item.parent ||
    "";

  const resolvedCategoryId =
    item.categoryId ||
    item.CategoryID ||
    item.CategoryId ||
    item.category_id ||
    item.parentId ||
    item.parentCategoryId ||
    "";

  return {
    name,
    SubCategoryID: String(id),
    uniqueKey: `${id}-${index}`,
    categoryId: String(resolvedCategoryId),
    categoryName: resolvedCategoryName,
    imageUrl,
  };
};

// categoryApi relevance ranker
const rankByRelevance = (items, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;

  const queryWords = normalizedQuery.split(" ");

  const scored = items
    .map((item) => {
      const normalizedName = normalizeSearchText(item.name || "");
      const nameWords = normalizedName.split(" ");

      const allWordsMatch = queryWords.every((queryWord) => {
        return nameWords.some((nameWord) => {
          if ((queryWord === "men" || queryWord === "mens") && (nameWord.includes("women") || nameWord.includes("womens"))) {
            return false;
          }
          return nameWord.startsWith(queryWord) || nameWord.includes(queryWord);
        });
      });

      if (!allWordsMatch) {
        return null;
      }

      let score = 0;
      if (normalizedName === normalizedQuery) {
        score = 100;
      } else {
        const startsCorrectly = queryWords.every(
          (word, index) => {
            return nameWords[index]?.startsWith(word) || nameWords[index]?.includes(word);
          }
        );
        if (startsCorrectly) {
          score = 80;
        } else {
          score = 60;
        }
      }

      return { item, score };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
};

// listingApi pincode helper
const getSellerPinCode = () => {
  const CACHE_KEY = "__haatza_sellerPinCode";
  const cached =
    sessionStorage.getItem(CACHE_KEY) ||
    localStorage.getItem(CACHE_KEY);
  if (cached && /^\d{6}$/.test(cached.trim())) {
    return cached.trim();
  }

  const plainKeys = ["sellerPinCode", "pinCode", "pincode", "seller_pincode"];
  for (const key of plainKeys) {
    const val = sessionStorage.getItem(key);
    if (val && /^\d{6}$/.test(val.trim())) return val.trim();
  }
  for (const key of plainKeys) {
    const val = localStorage.getItem(key);
    if (val && /^\d{6}$/.test(val.trim())) return val.trim();
  }

  const jsonKeys = ["user", "authUser", "currentUser", "userData", "sellerData"];
  const pinFields = ["pinCode", "pincode", "sellerPinCode", "seller_pincode"];
  for (const store of [sessionStorage, localStorage]) {
    for (const key of jsonKeys) {
      const raw = store.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        for (const field of pinFields) {
          const val = parsed?.[field] || parsed?.user?.[field] || parsed?.data?.[field];
          if (val && /^\d{6}$/.test(String(val).trim())) return String(val).trim();
        }
      } catch { }
    }
  }

  console.error("[listingApi:getSellerPinCode] pinCode not found — using fallback 000000");
  return "000000";
};

// Centralized getSellerId is imported from sellerSession

// listingApi wix image helper helper
const toWixSrc = (url) => {
  if (!url) return null;
  if (url.startsWith("wix:image://")) return url;
  if (!url.startsWith("http")) return null;
  const wixMatch = url.match(/\/media\/([a-zA-Z0-9_~.-]+)/);
  if (!wixMatch) return null;
  const fileId = wixMatch[1];
  const parts = url.split("/");
  const fileName = parts[parts.length - 1].split("?")[0] || "image.jpg";
  return `wix:image://v1/${fileId}/${fileName}#originWidth=800&originHeight=800`;
};

// listingApi size chart url resolver
const resolveSizeChartUrl = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    if (value.trim() === "__PENDING_FILE__" || value.trim() === "") return "";
    return value.trim();
  }

  if (value instanceof File) {
    console.warn("[resolveSizeChartUrl] Raw File object reached payload builder — skipping gracefully");
    return "";
  }

  if (typeof value === "object") {
    const candidateUrl =
      value.url ||
      value.mediaUrl ||
      value.src ||
      value.imageUrl ||
      value.fileUrl ||
      (value.preview && !value.preview.startsWith("blob:") ? value.preview : "");

    if (typeof candidateUrl === "string" && candidateUrl.trim() !== "__PENDING_FILE__") {
      return candidateUrl.trim();
    }
  }

  return "";
};

// MyListings envelope unwrapper helper
const unwrapMyListingsEnvelope = (data, fallbackLimit = 10) => {
  console.log("[unwrapMyListingsEnvelope] Raw data:", JSON.stringify(data, null, 2));

  if (data?.status && data.status !== "success") {
    const body = data?.message?.body ?? data?.message ?? {};
    const msg =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      (typeof data?.message === "string" && data.message) ||
      body?.errorMessage ||
      body?.reason ||
      body?.details ||
      (typeof body === "object" ? JSON.stringify(body) : String(body)) ||
      "The server returned an error.";
    console.error("[unwrapMyListingsEnvelope] Backend error:", msg, "| Full body:", body);
    throw new Error(msg);
  }

  const body = data?.message?.body ?? data?.body ?? data ?? {};
  const rawProducts = body.sellerProducts ?? body.products ?? body.items ?? [];
  const products = rawProducts.map((p) => {
    if (!p) return p;
    const Table_ID = p.Table_ID || p.tableId || p.table_id || p.productId || p._id || p.id || "";
    return {
      ...p,
      Table_ID,
      mainmedia: resolveWixImage(p.mainmedia || p.main_media || p.mainMedia || p.mainImage || "") || "",
    };
  });
  const pagination = body.pagination ?? {};

  const total = pagination.total ?? body.total ?? products.length;
  const page = pagination.page ?? body.page ?? 1;
  const limit = pagination.limit ?? body.limit ?? fallbackLimit;
  const totalPages = pagination.totalPages ?? body.totalPages ??
    (total > 0 ? Math.ceil(total / limit) : 1);

  console.log("[unwrapMyListingsEnvelope] Success:", { products: products.length, total, page, totalPages });
  return { products, total, page, totalPages };
};

// InProgressListings envelope unwrapper helper
const unwrapInProgressListingsEnvelope = (data, fallbackLimit = 10) => {
  console.group("[unwrapInProgressListingsEnvelope] Raw data");
  console.log(JSON.stringify(data, null, 2));
  console.groupEnd();

  if (data?.status && data.status !== "success") {
    const body = data?.message?.body ?? data?.message ?? {};

    const msg =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      (typeof data?.message === "string" && data.message) ||
      body?.errorMessage ||
      body?.reason ||
      body?.details ||
      (typeof body === "object" ? JSON.stringify(body) : String(body)) ||
      "The server returned an error.";

    console.error("[unwrapInProgressListingsEnvelope] Backend error:", msg);
    throw new Error(msg);
  }

  const body = data?.message?.body ?? data?.body ?? data ?? {};
  const rawProducts = body.sellerProducts ?? body.products ?? body.items ?? body.data ?? (Array.isArray(body) ? body : []);
  const products = rawProducts.map((p) => {
    if (!p) return p;
    const Table_ID = p.Table_ID || p.tableId || p.table_id || p.productId || p._id || p.id || "";
    const productId = p.productId || p.product_id || p.wixProductId || "";
    return { ...p, Table_ID, productId };
  });
  const pagination = body.pagination ?? {};

  const total = pagination.total ?? body.total ?? products.length;
  const page = pagination.page ?? body.page ?? 1;
  const limit = pagination.limit ?? body.limit ?? fallbackLimit;
  const totalPages = pagination.totalPages ?? body.totalPages ??
    (total > 0 ? Math.ceil(total / limit) : 1);

  console.group("[unwrapInProgressListingsEnvelope] Products received");
  console.log(`Count: ${products.length}, Total: ${total}, Page: ${page}/${totalPages}`);
  products.forEach((p, i) => {
    console.log(`  [${i}] id=${p.Table_ID || p._id || "?"} name="${p.name || "?"}" status="${p.status || "?"}" price=${p.price ?? "?"}`);
  });
  console.groupEnd();

  return { products, total, page, totalPages };
};


/* =============================================================================
  // AUTH APIs
  ============================================================================= */

export const checkSeller = async (contact) => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const isPhone = /^[6-9]\d{9}$/.test(contact);

  if (!isEmail && !isPhone) {
    throw new Error("Enter a valid email address or 10-digit mobile number.");
  }

  const contactType = isEmail ? "email" : "phone";
  const param = `${contactType}=${encodeURIComponent(contact)}`;

  try {
    const response = await axios.get(`${PROFILE_BASE_URL}/checkseller?${param}`, {
      timeout: 10000,
    });
    const data = response.data;

    if (data?.status !== "success") {
      throw new Error(data?.message || "Unexpected response from server.");
    }

    return {
      userExists: data.message.userExists,
      contactType,
      email: data.message.email || "",
      phone: data.message.phone || "",
    };
  } catch (err) {
    console.error("[checkSeller] Error checking contact existence:", err);
    throw new Error(
      err.response?.data?.message || err.message || "Server connection issues. Please try again."
    );
  }
};


/* =============================================================================
  // SELLER PROFILE APIs
  ============================================================================= */

export const fetchSellerDetails = async (email) => {
  if (!email) throw new Error("Email is required.");
  try {
    const response = await axios.get(`${PROFILE_BASE_URL}/sellerdata`, {
      params: { email },
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    console.error("[fetchSellerDetails] Error:", err);
    throw new Error(err.response?.data?.message || "Failed to fetch seller details.");
  }
};

export const getUserProfile = async (email) => {
  const response = await axios.get(`${PROFILE_BASE_URL}/sellerdata`, {
    params: { email },
    timeout: 10000,
  });
  return response.data;
};

export const getCachedSellerId = () => {
  const CANONICAL_SELLER_KEY = "__haatza_sellerId";
  const val =
    sessionStorage.getItem(CANONICAL_SELLER_KEY) ||
    localStorage.getItem(CANONICAL_SELLER_KEY) ||
    sessionStorage.getItem("sellerId") ||
    localStorage.getItem("sellerId") ||
    "";
  if (!val || val.trim().length < 2) {
    console.warn("[sellerProfileApi] getCachedSellerId: no sellerId found");
  }
  return val.trim();
};

export const getCachedSellerPinCode = () => {
  const CANONICAL_PIN_KEY = "__haatza_sellerPinCode";
  const val =
    sessionStorage.getItem(CANONICAL_PIN_KEY) ||
    localStorage.getItem(CANONICAL_PIN_KEY) ||
    sessionStorage.getItem("sellerPinCode") ||
    localStorage.getItem("sellerPinCode") ||
    "";
  if (!val || !/^\d{6}$/.test(val.trim())) {
    console.warn("[sellerProfileApi] getCachedSellerPinCode: invalid or missing pinCode:", val);
  }
  return val.trim();
};

// Centralized resolveSellerEmailForApi is imported from sellerSession


/* =============================================================================
  // CATEGORY APIs
  ============================================================================= */

export const fetchCategories = async () => {
  try {
    const res = await fetch(CATEGORY_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    console.log("🗂️ [fetchCategories] top-level keys:", Object.keys(data));

    const raw = Array.isArray(data.message) ? data.message : extractArray(data);
    console.log(`🗂️ [fetchCategories] raw array length: ${raw.length}`);

    return raw.map(normaliseCategory);
  } catch (err) {
    console.error("[fetchCategories]", err);
    return [];
  }
};

export const fetchSubcategoriesFirstPage = async (categoryId) => {
  const cleanId = String(categoryId ?? "").trim();
  console.log(`[fetchSubcategoriesFirstPage] categoryId="${cleanId}"`);

  const subUrl = (catId, page = 1, limit = 50) =>
    `https://www.haatza.com/_functions/subCategories?categoryId=${catId}&page=${page}&limit=${limit}`;

  try {
    const res = await fetch(subUrl(cleanId, 1, 50));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    console.log(`📡 [fetchSubcategoriesFirstPage] top-level keys:`, Object.keys(data));

    const raw = extractArray(data);
    console.log(`📡 [fetchSubcategoriesFirstPage] raw array length: ${raw.length}`);

    const normalised = raw.map(normaliseSubcategory);
    console.log(`[fetchSubcategoriesFirstPage] → ${normalised.length} subcategories`);

    return {
      items: normalised,
      hasMore: normalised.length === 50,
    };
  } catch (err) {
    console.error("[fetchSubcategoriesFirstPage]", err);
    return { items: [], hasMore: false };
  }
};

export const fetchSubcategoriesPaged = async (categoryId, page = 1, limit = 50) => {
  const cleanId = String(categoryId ?? "").trim();
  console.log(`[fetchSubcategoriesPaged] categoryId="${cleanId}" page=${page}`);

  const subUrl = (catId, p, l) =>
    `https://www.haatza.com/_functions/subCategories?categoryId=${catId}&page=${p}&limit=${l}`;

  try {
    const res = await fetch(subUrl(cleanId, page, limit));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const raw = extractArray(data);
    const normalised = raw.map(normaliseSubcategory);
    console.log(`[fetchSubcategoriesPaged] page=${page} → ${normalised.length} items`);

    return {
      items: normalised,
      hasMore: normalised.length === limit,
    };
  } catch (err) {
    console.error("[fetchSubcategoriesPaged]", err);
    return { items: [], hasMore: false };
  }
};

export const fetchSubcategories = fetchSubcategoriesFirstPage;

export const searchCategories = async (query = "") => {
  try {
    const url =
      `https://haatza.com/_functions/subcategorylist` +
      `?page=1&count=10&search=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items = extractArray(data);
    const seen = new Set();

    return items
      .filter((item) => {
        const cid = item.categoryId || item.CategoryID;
        if (!cid || seen.has(cid)) return false;
        seen.add(cid);
        return true;
      })
      .map((item, i) => ({
        CategoryID: item.categoryId || item.CategoryID,
        name: item.categoryName || item.CategoryName || "Unnamed",
        uniqueKey: `cat-s-${i}`,
      }));
  } catch (err) {
    console.error("[searchCategories]", err);
    return [];
  }
};

export const searchSubcategories = async (query = "", _categoryId = null) => {
  try {
    const normalizedQuery = normalizeSearchText(query);

    const url =
      `https://haatza.com/_functions/subcategorylist` +
      `?page=1&count=100&search=${encodeURIComponent(query.trim())}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw = extractArray(data).map(normaliseSubcategory);
    const filtered = rankByRelevance(raw, normalizedQuery);

    return filtered;
  } catch (err) {
    console.error("[searchSubcategories]", err);
    return [];
  }
};

export const normalizeSearchText = (text = "") => {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/-/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};


/* =============================================================================
  // GST APIs
  ============================================================================= */

export const checkGSTINExists = async (gstin) => {
  const url = `${GST_API_URL}?gstin=${encodeURIComponent(gstin)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const data = await res.json();

  if (typeof data.exists === "boolean") return data.exists;
  if (typeof data.registered === "boolean") return data.registered;
  if (typeof data.found === "boolean") return data.found;
  if (data.status === "exists") return true;
  if (data.status === "not_found") return false;

  return false;
};


/* =============================================================================
  // INVENTORY APIs
  ============================================================================= */

export const fetchInventoryData = async (sellerId, page = 1, searchText = "", signal = null) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(SELLER_PRODUCT_INVENTORY_API, {
    params: { sellerId: resolvedSellerId, page, searchText },
    timeout: 15000,
    signal,
  });
  return response.data;
};

export const getSellerProductInventory = async ({ sellerId, page = 1, searchText = "", signal = null }) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(SELLER_PRODUCT_INVENTORY_API, {
    params: { sellerId: resolvedSellerId, page, searchText },
    timeout: 15000,
    signal,
  });
  return response.data;
};

export const incrementInventory = async (sellerId, productId, variantId, quantity) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    INCREMENT_INVENTORY_API,
    { sellerId: resolvedSellerId, productId, variantId, quantity },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const decrementInventory = async (sellerId, productId, variantId, quantity) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    DECREMENT_INVENTORY_API,
    { sellerId: resolvedSellerId, productId, variantId, quantity },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const updateInventoryStock = async (sellerId, item, newQty) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const delta = newQty - item.stock;
  if (delta === 0) return item;

  const endpoint = delta > 0 ? "incrementInventory" : "decrementInventory";
  const absQty = Math.abs(delta);

  try {
    const response = await axios.post(`${API_BASE_URL}/${endpoint}`, {
      sellerId: resolvedSellerId,
      productId: item.productId,
      variantId: item.id,
      quantity: absQty,
    }, {
      headers: { "Content-Type": "application/json" },
      timeout: 10_000,
    });

    if (response.data?.status === "error") {
      throw new Error(response.data?.message || "Action failed on server.");
    }

    return {
      ...item,
      stock: newQty,
    };
  } catch (err) {
    console.error(`[updateInventoryStock] Error on ${endpoint}:`, err);
    throw new Error(err.response?.data?.message || `Failed to update quantity on server.`);
  }
};


/* =============================================================================
  // LISTING APIs
  ============================================================================= */

export const resolveWixImage = (img) => {
  if (!img) return null;
  const raw =
    typeof img === "string"
      ? img
      : img.src || img.url || img.image || img.imageUrl || null;
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    if (raw.includes("static.wixstatic.com/media/")) {
      const parts = raw.split("static.wixstatic.com/media/");
      if (parts.length > 1) {
        const pathPart = parts[1].split("?")[0].split("#")[0];
        const pathSegments = pathPart.split("/");
        let fileId = pathSegments[0];
        if (pathSegments.length > 1) {
          if (!fileId.includes(".") && pathSegments[1].includes(".")) {
            const ext = pathSegments[1].split(".").pop();
            fileId = `${fileId}.${ext}`;
          }
        }
        return `https://static.wixstatic.com/media/${fileId}`;
      }
    }
    return raw;
  }
  if (raw.startsWith("wix:image://")) {
    const withoutScheme = raw.replace(/^wix:image:\/\//, "");
    const withoutVersion = withoutScheme.replace(/^v1\//, "");
    const hashIdx = withoutVersion.indexOf("#");
    const pathPart = hashIdx !== -1 ? withoutVersion.substring(0, hashIdx) : withoutVersion;
    const pathSegments = pathPart.split("/");
    let fileId = pathSegments[0];
    let fileName = pathSegments[1] || "";
    if (!fileId || fileId.length > 200 || fileId.includes(" ")) return null;
    if (fileId.includes(".")) {
      return `https://static.wixstatic.com/media/${fileId}`;
    }
    if (fileName && fileName.includes(".")) {
      const ext = fileName.split(".").pop();
      return `https://static.wixstatic.com/media/${fileId}.${ext}`;
    }
    return `https://static.wixstatic.com/media/${fileId}~mv2.jpg`;
  }
  return null;
};

export const buildMediaItems = (images = []) => {
  return images
    .filter((img) => img.mediaUrl || img.url || img.src)
    .map((img) => {
      const url = img.mediaUrl || img.url || img.src || "";

      let parsedWixResponse = null;
      if (img.wixResponse) {
        if (typeof img.wixResponse === "object") {
          parsedWixResponse = img.wixResponse;
        } else if (typeof img.wixResponse === "string") {
          try {
            parsedWixResponse = JSON.parse(img.wixResponse);
          } catch { }
        }
      }

      const wixSrc =
        img.wixSrc ||
        parsedWixResponse?.src ||
        (url.startsWith("wix:image://") ? url : toWixSrc(url));

      let fileId = "";
      if (wixSrc && wixSrc.startsWith("wix:image://")) {
        const withoutScheme = wixSrc.replace(/^wix:image:\/\//, "");
        const withoutVersion = withoutScheme.replace(/^v1\//, "");
        fileId = withoutVersion.split("/")[0] || "";
      }

      if (!fileId) {
        const parts = url.split("/");
        fileId = parts[parts.length - 1].split("?")[0] || "image.jpg";
      }

      return {
        description: "",
        id: fileId,
        src: wixSrc || url,
        type: "image",
      };
    });
};

export const buildPromotionPhotos = (promotionImage) => {
  if (!promotionImage) return [];
  const url = promotionImage.url || promotionImage.mediaUrl || promotionImage.src || "";
  if (!url) return [];

  console.log("[buildPromotionPhotos] Input URL type:", url.startsWith("data:") ? "base64" : url.startsWith("wix:") ? "wix" : "https");

  if (url.startsWith("data:")) {
    const fileName = promotionImage.name || "promo.jpg";
    return [
      {
        description: "",
        id: fileName,
        src: url,
        type: "image",
      },
    ];
  }

  let parsedWixResponse = null;
  if (promotionImage.wixResponse) {
    if (typeof promotionImage.wixResponse === "object") {
      parsedWixResponse = promotionImage.wixResponse;
    } else if (typeof promotionImage.wixResponse === "string") {
      try {
        parsedWixResponse = JSON.parse(promotionImage.wixResponse);
      } catch { }
    }
  }

  const wixSrc =
    promotionImage.wixSrc ||
    parsedWixResponse?.src ||
    (url.startsWith("wix:image://") ? url : toWixSrc(url));

  let fileId = "";
  if (wixSrc && wixSrc.startsWith("wix:image://")) {
    const withoutScheme = wixSrc.replace(/^wix:image:\/\//, "");
    const withoutVersion = withoutScheme.replace(/^v1\//, "");
    fileId = withoutVersion.split("/")[0] || "";
  }

  if (!fileId) {
    const parts = url.split("/");
    fileId = parts[parts.length - 1].split("?")[0] || "promo.jpg";
  }

  return [
    {
      description: "",
      id: fileId,
      src: wixSrc || url,
      type: "image",
    },
  ];
};

export const buildDiscount = (formData, discountType = "percent") => {
  if (!formData.onSale || !formData.discountPercent) return {};
  const val = parseFloat(formData.discountPercent);
  if (isNaN(val) || val <= 0) return {};
  if (discountType === "flat") {
    return {
      type: "AMOUNT",
      value: val,
    };
  } else {
    const price = parseFloat(formData.price) || 0;
    const amount = (price * val) / 100;
    return {
      type: "AMOUNT",
      value: amount,
    };
  }
};

export const resolveProductReturn = (val) => {
  if (!val) return "7 Days Easy Return";
  const mapped = {
    return: "7 Days Easy Return",
    no_return: "No Return",
    exchange: "7 Days Exchange",
    return_or_exchange: "7 Days Return or Exchange",
  }[val] || val;
  return mapped.replace(/\breturn\b/g, "Return");
};

export const buildAdditionalInfoSections = (specValues = {}, optionKeys = new Set(), specFieldsList = []) => {
  const sections = [];
  if (specFieldsList && specFieldsList.length > 0) {
    for (const field of specFieldsList) {
      const key = field.fieldId || field.title;
      const value = specValues[key];
      if (value === undefined || value === null || value === "") continue;
      if (value instanceof File) continue;
      if (typeof value === "object" && (value.isExisting || value.url || value.mediaUrl || value.src)) continue;
      const keyLower = key.toLowerCase();
      if (
        keyLower.includes("sizechart") || keyLower.includes("size_chart") ||
        keyLower.includes("size chart") || keyLower.includes("upload")
      ) continue;
      if (value === "__PENDING_FILE__") continue;
      const display = Array.isArray(value) ? value.join(", ") : String(value);
      if (!display) continue;
      sections.push({ [field.title]: display });
    }
    return sections;
  }

  for (const [key, value] of Object.entries(specValues)) {
    if (optionKeys.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (value instanceof File) continue;
    if (typeof value === "object" && (value.isExisting || value.url || value.mediaUrl || value.src)) continue;
    const keyLower = key.toLowerCase();
    if (
      keyLower.includes("sizechart") || keyLower.includes("size_chart") ||
      keyLower.includes("size chart") || keyLower.includes("upload")
    ) continue;
    if (value === "__PENDING_FILE__") continue;
    const display = Array.isArray(value) ? value.join(", ") : String(value);
    if (!display) continue;
    sections.push({ [key]: display });
  }
  return sections;
};

export const buildProductOptions = (optionFields = [], specValues = {}, colourImages = {}, confirmedColors = []) => {
  const options = {};
  for (const field of optionFields) {
    const key = field.fieldId || field.title;
    const val = specValues[key];
    const isColour = field.title.toLowerCase() === "color" ||
      field.title.toLowerCase() === "colour" ||
      (field.elementType || "").toLowerCase() === "color picker";

    if (isColour) {
      const colorList = confirmedColors.length > 0 ? confirmedColors : [];
      const selected = Array.isArray(val) ? val : (val ? [val] : []);
      const finalList = colorList.length > 0 ? colorList : selected.map(v => ({ name: v, hex: v }));
      if (finalList.length === 0) continue;

      options[field.title] = {
        optionType: "color",
        name: field.title,
        choices: finalList.map(c => {
          const colorName = c.name || c;
          const colorHex = c.hex || c;
          const choice = {
            description: colorName,
            value: colorHex,
          };
          const img = colourImages[colorName];
          if (img) {
            const urls = Array.isArray(img)
              ? img.filter(Boolean)
              : typeof img === "string"
                ? [img]
                : img instanceof File
                  ? []
                  : [(img?.url || img?.mediaUrl || img?.src || "")].filter(Boolean);
            if (urls.length > 0) {
              choice.mediaItems = urls.map(url => ({
                id: url.split("/").pop()?.split("?")[0] || colorName,
                src: url,
                type: "image",
              }));
            }
          }
          return choice;
        }),
      };
    } else {
      if (!val) continue;
      const selected = Array.isArray(val) ? val : [val];
      if (selected.length === 0) continue;
      options[field.title] = {
        optionType: "drop_down",
        name: field.title,
        choices: selected.map(v => ({
          description: String(v),
          value: String(v),
        })),
      };
    }
  }
  return options;
};

export const buildVarientPrice = (variants = [], variantPrices = {}, basePrice = 0) => {
  if (variants.length === 0) return {};
  const base = parseFloat(basePrice) || 0;
  const products = variants.map((v) => {
    const priceData = variantPrices[v.key];
    const finalPrice = base + (parseFloat(priceData?.appliedDiff ?? 0) || 0);
    const choices = {};
    if (v.color) choices["Color"] = v.color;
    if (v.optionLabel) choices[v.optionField] = v.optionLabel;
    return {
      variantInfo: [
        {
          choices,
          price: finalPrice,
        },
      ],
    };
  });
  return { products };
};

export const createListing = async (payload) => {
  const safePayload = typeof payload === "string" ? JSON.parse(payload) : payload;

  console.group("[createListing] Request diagnostics");
  console.log("Seller Listing Payload", JSON.parse(JSON.stringify(safePayload)));
  console.log("Saved Seller ID", safePayload.sellerId);
  console.log("Status being sent:", safePayload.status);
  console.log("Seller email (from storage):", resolveSellerEmailForApi());
  console.groupEnd();

  const res = await fetch(`${BASE_URL}/sellerlisting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  });

  let data = {};
  try { data = await res.json(); } catch { }

  console.group("[createListing] Response diagnostics");
  console.log("HTTP status:", res.status);
  console.log("Seller Listing Response", JSON.parse(JSON.stringify(data)));
  console.groupEnd();

  if (!res.ok) {
    const errBody = data?.message?.body ?? data?.message ?? data ?? {};
    const msg = errBody?.message || errBody?.error || `Create listing failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const body =
    data?.message?.data ??
    data?.message?.body ??
    data?.body ??
    data ??
    {};

  if (data?.status && data.status !== "success") {
    const msg = body?.message || body?.error || "Create listing failed.";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return body;
};

export const updateListing = async (payload) => {
  const safePayload = typeof payload === "string" ? JSON.parse(payload) : payload;

  console.group("[updateListing] Request diagnostics");
  console.log("Update Listing Payload", JSON.parse(JSON.stringify(safePayload)));
  console.log("Saved Seller ID", safePayload.sellerId || safePayload.Id);
  console.log("Status being sent:", safePayload.status);
  console.groupEnd();

  const res = await fetch(`${BASE_URL}/updateSellerProduct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  });

  let data = {};
  try { data = await res.json(); } catch { }

  console.group("[updateListing] Response diagnostics");
  console.log("HTTP status:", res.status);
  console.log("Update Listing Response", data);
  console.groupEnd();

  if (!res.ok) {
    const errBody = data?.message?.body ?? data?.message ?? data ?? {};
    const msg = errBody?.message || errBody?.error || `Update listing failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const body = data?.message?.body ?? data?.body ?? data ?? {};
  if (data?.status && data.status !== "success") {
    const msg = body?.message || body?.error || "Update listing failed.";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return body;
};

export const buildCreatePayload = ({
  formData,
  images = [],
  category,
  subcategory,
  specifications = {},
  optionFields = [],
  variants = [],
  variantPrices = {},
  promotionImage = null,
  keywords = [],
  discountType = "percent",
  statusOverride = "Under Review",
  colourImages = {},
  confirmedColors = [],
  specFieldsList = [],
}) => {
  const successImages = images.filter((i) => i.mediaUrl || i.url || i.src);
  const rawMainmedia = successImages[0]?.mediaUrl || successImages[0]?.url || successImages[0]?.src || "";
  const mainmedia = resolveWixImage(rawMainmedia) || rawMainmedia;
  const mediaItems = buildMediaItems(successImages);
  const productImages = mediaItems;
  const promoPhotosArr = buildPromotionPhotos(promotionImage);
  const promotionPhotos = promoPhotosArr;
  const discount = buildDiscount(formData, discountType);
  const optionKeys = new Set(optionFields.map((f) => f.fieldId || f.title));
  const additionalInfoSections = buildAdditionalInfoSections(specifications, optionKeys, specFieldsList);
  const productOptions = buildProductOptions(optionFields, specifications, colourImages, confirmedColors);
  const base = parseFloat(formData.price) || 0;
  const effectivePrice = formData.onSale && formData.salePrice
    ? parseFloat(formData.salePrice) || base
    : base;
  const varientPrice = buildVarientPrice(variants, variantPrices, effectivePrice);

  const sizeChartEntry = Object.entries(specifications).find(([, v]) => {
    if (!v || v === "__PENDING_FILE__" || v instanceof File) return false;
    if (typeof v === "object" && v.url && (v.url.startsWith("http://") || v.url.startsWith("https://") || v.url.startsWith("wix:image://")) && !v.url.includes("__PENDING")) return true;
    if (typeof v === "object" && (v.mediaUrl || v.src)) return true;
    if (typeof v === "string" && (v.startsWith("https://") || v.startsWith("http://") || v.startsWith("wix:image://"))) return true;
    return false;
  });
  const sizeChartVal = sizeChartEntry?.[1];
  const sizeChart = sizeChartVal ? (resolveWixImage(resolveSizeChartUrl(sizeChartVal)) || "") : "";

  const sellerId = getSellerId();
  const sellerPinCode = getSellerPinCode();
  const sellerEmail = resolveSellerEmailForApi();

  const subCatId =
    subcategory?.SubCategoryID ||
    subcategory?.subcategoryId ||
    subcategory?._id ||
    subcategory?.id ||
    "";

  const catId =
    category?.CategoryID ||
    category?._id ||
    category?.id ||
    "";

  return {
    sellerId,
    sellerEmail,
    sellerPinCode: parseInt(sellerPinCode, 10) || 0,
    categoryName: [category?.name || ""],
    categoryId: [catId],
    mediaItems,
    productImages,
    mainCategory: catId,
    subCategory: subcategory?.name || "",
    subCategoryId: subCatId,
    promotionPhotos,
    paymentType: formData.acceptCOD === "yes" ? "Cash on Delivery Available" : "prepaid",
    productReturn: resolveProductReturn(formData.productReturn),
    deliveryCharges: formData.deliveryCharge === "yes",
    shippingWeight: parseFloat(formData.shippingWeight) || 0,
    totalQuantity: parseInt(formData.availableStock, 10) || 5,
    brand: formData.brand || "",
    status: statusOverride,
    mainmedia,
    name: formData.productName || "",
    price: base,
    sku: formData.sku || "",
    productType: "physical",
    haatzaverified: false,
    sizeChart: sizeChart || "",
    discount,
    manageVariants: Object.keys(productOptions).length > 0,
    search_keywords: keywords || [],
    keywords: keywords || [],
    resellingProfit: parseFloat(formData.resellingProfit) || 0,
    sellAndEarnCommission: parseFloat(formData.resellingProfit) || 0,
    sellAndEarn: !!formData.resellingProfit,
    productOptions,
    varientPrice,
    additionalInfoSections,
  };
};

export const buildUpdatePayload = ({
  tableId,
  formData,
  images = [],
  category,
  subcategory,
  specifications = {},
  optionFields = [],
  variants = [],
  variantPrices = {},
  promotionImage = null,
  keywords = [],
  discountType = "percent",
  editData = {},
  statusOverride = "Under Review",
  colourImages = {},
  confirmedColors = [],
  specFieldsList = [],
}) => {
  const successImages = images.filter((i) => i.mediaUrl || i.url || i.src);
  const rawMainmedia = successImages[0]?.mediaUrl || successImages[0]?.url || successImages[0]?.src || editData?.mainmedia || "";
  const mainmedia = resolveWixImage(rawMainmedia) || rawMainmedia;
  const mediaItems = buildMediaItems(successImages);
  const promoPhotosArr = buildPromotionPhotos(promotionImage);
  const promotionPhotos = promoPhotosArr;
  const discount = buildDiscount(formData, discountType);
  const optionKeys = new Set(optionFields.map((f) => f.fieldId || f.title));
  const additionalInfoSections = buildAdditionalInfoSections(specifications, optionKeys, specFieldsList);
  const productOptions = buildProductOptions(optionFields, specifications, colourImages, confirmedColors);
  const base = parseFloat(formData.price) || 0;
  const effectivePrice = formData.onSale && formData.salePrice
    ? parseFloat(formData.salePrice) || base
    : base;
  const varientPrice = buildVarientPrice(variants, variantPrices, effectivePrice);

  const sizeChartEntry = Object.entries(specifications).find(([, v]) => {
    if (!v || v === "__PENDING_FILE__" || v instanceof File) return false;
    if (typeof v === "object" && v.url && (v.url.startsWith("http://") || v.url.startsWith("https://") || v.url.startsWith("wix:image://")) && !v.url.includes("__PENDING")) return true;
    if (typeof v === "object" && (v.mediaUrl || v.src)) return true;
    if (typeof v === "string" && (v.startsWith("https://") || v.startsWith("http://") || v.startsWith("wix:image://"))) return true;
    return false;
  });
  const sizeChartVal = sizeChartEntry?.[1];
  const sizeChart = sizeChartVal ? (resolveWixImage(resolveSizeChartUrl(sizeChartVal)) || "") : "";

  const productImages = mediaItems;

  const sellerId = getSellerId();
  const sellerPinCode = getSellerPinCode();
  const sellerEmail = resolveSellerEmailForApi();

  const catId =
    category?.CategoryID ||
    category?._id ||
    category?.id ||
    editData?.categoryId?.[0] ||
    editData?.mainCategory ||
    "";

  const subCatId =
    subcategory?.SubCategoryID ||
    subcategory?.subcategoryId ||
    subcategory?._id ||
    subcategory?.id ||
    editData?.subCategoryId ||
    editData?.SubCategoryID ||
    "";

  return {
    Id: tableId,
    sellerId,
    sellerEmail,
    sellerPinCode: parseInt(sellerPinCode, 10) || 0,
    name: formData.productName || "",
    productImages,
    description: editData?.description || "",
    shippingWeight: parseFloat(formData.shippingWeight) || 0,
    brand: formData.brand || "",
    status: statusOverride,
    mainmedia,
    productOptions,
    price: base,
    discount,
    manageVariants: Object.keys(productOptions).length > 0,
    ribbon: editData?.ribbon || "",
    varientPrice,
    additionalInfoSections,
    paymentType: formData.acceptCOD === "yes" ? "Cash on Delivery Available" : "prepaid",
    productReturn: resolveProductReturn(formData.productReturn),
    deliveryCharges: formData.deliveryCharge === "yes",
    totalQuantity: parseInt(formData.availableStock, 10) || editData?.totalQuantity || 5,
    resellingProfit: parseFloat(formData.resellingProfit) || 0,
    sellAndEarn: !!formData.resellingProfit,
    sellAndEarnCommission: parseFloat(formData.resellingProfit) || 0,
    search_keywords: keywords,
    promotionPhotos,
    sizeChart: sizeChart || "",
    mediaItems,
    categoryName: category?.name ? [category.name] : (editData?.categoryName || []),
    categoryId: catId ? [catId] : (editData?.categoryId || []),
    mainCategory: catId,
    subCategory: subcategory?.name || editData?.subCategory || "",
    subCategoryId: subCatId,
    sku: formData.sku || editData?.sku || "",
    productType: "physical",
  };
};

export const normalizeSettlementSummary = (response) => {
  const body =
    response?.message?.body ||
    response?.message?.data ||
    response?.message ||
    response?.data ||
    response ||
    {};

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  return {
    status: response?.status || "success",

    sellingPrice: toNumber(
      body.sellingPrice ||
      body.sellingprice ||
      body.orderAmount
    ),

    productGST: toNumber(
      body.productGST ||
      body.gst ||
      body.GST ||
      body.gstAmount
    ),

    tcs: toNumber(
      body.tcsAmount ||
      body.tcs ||
      body.TCS
    ),

    tds: toNumber(
      body.tdsAmount ||
      body.tds ||
      body.TDS
    ),

    commission: toNumber(
      body.commission ||
      body.Commission ||
      body.platformCommission ||
      body.haatzaCommission
    ),

    gstOnCommission: toNumber(
      body.gstOnCommission ||
      body.gstOnPlatformCommission ||
      body.commissionGst
    ),

    pgCharges: toNumber(
      body.pgCharges ||
      body.paymentGatewayCharges ||
      body.pgFee
    ),

    gstOnPgCharges: toNumber(
      body.gstOnPgCharges ||
      body.gstOnPaymentGatewayCharges ||
      body.pgChargesGst
    ),

    shippingFee: toNumber(
      body.approxShippingFee ||
      body.shippingFee ||
      body.shipping ||
      body.shippingCharge
    ),

    gstOnShippingFee: toNumber(
      body.gstOnShippingFee ||
      body.shippingFeeGst ||
      body.gstOnShipping
    ),

    fixedFee: toNumber(
      body.fixedFee ||
      body.fixedCharges
    ),

    handlingFee: toNumber(
      body.handlingFee ||
      body.handlingCharges
    ),

    totalDebit: toNumber(
      body.totalDebit ||
      body.totalDeductions ||
      body.debit
    ),

    settlementAmount: toNumber(
      body.settlementAmount ||
      body.approxSettlementAmount ||
      body.netAmount ||
      body.netSettlement ||
      body.approxSettlement
    ),

    note: body.note || body.message_note || body.noteText || "",

    raw: body
  };
};

export const getSettlementSummary = async ({
  orderAmount,
  categoryId,
  deliveryCharges,
  shippingWeight,
  sellerPinCode,
  sellerId,
}) => {
  if (!sellerId) throw new Error("Missing sellerId for settlementsummary");

  const params = {
    orderAmount,
    categoryId,
    deliveryCharges,
    shippingWeight,
    sellerPinCode,
    sellerId,
  };

  console.log("[SettlementsPage] Settlement Summary Params", params);

  const res = await axios.get(`${HAATZA_BASE}/settlementsummary`, { params });

  console.log("[SettlementsPage] Settlement Summary Response", res.data);

  return res.data;
};

export const fetchSettlementSummary = async ({
  orderAmount,
  categoryId,
  deliveryCharges,
  shippingWeight,
  sellerPinCode,
  sellerId,
}) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const resolvedPin = sellerPinCode || getSellerPinCode();

  if (orderAmount === undefined || orderAmount === null || orderAmount === "") {
    throw new Error("orderAmount is required for settlement summary.");
  }

  if (!categoryId) {
    throw new Error("categoryId is required for settlement summary.");
  }

  if (shippingWeight === undefined || shippingWeight === null || shippingWeight === "") {
    throw new Error("shippingWeight is required for settlement summary.");
  }

  if (!resolvedPin) {
    throw new Error("sellerPinCode is required for settlement summary.");
  }

  const data = await getSettlementSummary({
    orderAmount,
    categoryId,
    deliveryCharges: Boolean(deliveryCharges),
    shippingWeight,
    sellerPinCode: resolvedPin,
    sellerId: resolvedSellerId,
  });

  return normalizeSettlementSummary(data);
};


/* =============================================================================
  // MY LISTINGS APIs
  ============================================================================= */

export const fetchSellerListings = async ({
  email,
  page = 1,
  limit = 10,
  type,
} = {}) => {
  if (!email?.trim()) {
    throw new Error("Seller email is required to fetch listings.");
  }

  const params = {
    email: email.trim(),
    page: Number(page) || 1,
    limit: Number(limit) || 10,
  };
  if (type) params.type = type;

  try {
    const response = await axios.get(
      `${BASE_URL}/seller_products`,
      { params, timeout: 15_000 }
    );
    return unwrapMyListingsEnvelope(response.data, params.limit);
  } catch (err) {
    if (!err.response) {
      throw err;
    }
    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof errBody?.error === "string" && errBody.error) ||
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      errBody?.errorMessage ||
      err.message ||
      "Unable to load listings. Please try again.";
    throw new Error(message);
  }
};

export const fetchProductDetails = async (tableId) => {
  if (!tableId) throw new Error("Product Table_ID is required.");

  try {
    const response = await axios.get(
      `${BASE_URL_WWW}/sellerProductDetails`,
      { params: { Table_ID: tableId }, timeout: 15_000 }
    );

    const data = response.data;
    const candidates = [
      data?.message?.body?.product,
      data?.message?.body,
      data?.body?.product,
      data?.body,
      data,
    ];

    const details = candidates.find(
      (c) =>
        c &&
        typeof c === "object" &&
        !Array.isArray(c) &&
        (c.name || c.price != null || c.status || c.Table_ID)
    ) ?? data;

    if (!details || typeof details !== "object") {
      throw new Error("Product not found or response format changed.");
    }

    const normalised = { ...details };

    normalised.Table_ID = normalised.Table_ID || normalised.tableId
      || normalised.table_id || normalised.productId || normalised._id || "";

    normalised.mainmedia = normalised.mainmedia || normalised.main_media
      || normalised.mainMedia || normalised.mainImage || "";

    normalised.productImages = normalised.productImages || normalised.product_images
      || normalised.images || normalised.mediaItems || [];

    const rawSizeChart = normalised.sizeChart || normalised.size_chart
      || normalised.sizeChartUrl || normalised.size_chart_url
      || normalised.sizeChartImage || "";
    normalised.sizeChart = resolveWixImage(rawSizeChart) || "";

    const rawPromo = normalised.promotionPhotos
      || normalised.promotion_photos || normalised.promoPhotos
      || normalised.promotionImages || [];
    const promoArr = Array.isArray(rawPromo) ? rawPromo : [rawPromo];
    normalised.promotionPhotos = promoArr
      .map(p => {
        if (!p) return null;
        const raw = typeof p === "string" ? p : p.src || p.url || p.image || null;
        return resolveWixImage(raw);
      })
      .filter(Boolean);

    if (!normalised.mediaItems) {
      normalised.mediaItems = normalised.productImages;
    }

    return normalised;
  } catch (err) {
    if (!err.response) throw err;
    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof body?.error === "string" && body.error) ||
      err.message ||
      "Unable to fetch product details.";
    throw new Error(message);
  }
};

export const fetchInProgressListings = async ({
  email,
  page = 1,
  limit = 10,
} = {}) => {
  if (!email?.trim()) {
    throw new Error("Seller email is required to fetch in-progress listings.");
  }

  const resolveStoredSellerId = () => {
    const keys = ["sellerId", "seller_id", "userId", "user_id", "user", "authUser", "currentUser", "userData", "sellerData"];
    for (const key of keys) {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!raw) continue;
      if (raw.length > 3 && !raw.startsWith("{") && !raw.startsWith("[")) return raw.trim();
      try {
        const parsed = JSON.parse(raw);
        const val = parsed?.sellerId || parsed?.seller_id || parsed?.userId || parsed?.user_id
          || parsed?.user?.sellerId || parsed?.data?.sellerId || null;
        if (val) return String(val).trim();
      } catch { }
    }
    return "";
  };

  const resolvedSellerId = resolveStoredSellerId();

  const params = {
    email: email.trim(),
    sellerEmail: email.trim(),
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    sellerId: resolvedSellerId || "",
  };

  try {
    let response = await axios.get(
      `${BASE_URL}/seller_products`,
      { params, timeout: 15_000 }
    );

    if (response.data) {
      const checkBody = response.data?.message?.body ?? response.data?.body ?? response.data ?? {};
      const checkProducts = checkBody.sellerProducts ?? checkBody.products ?? checkBody.items ?? [];
      if (checkProducts.length === 0) {
        try {
          response = await axios.get(
            `${BASE_URL_WWW}/seller_products`,
            { params, timeout: 15_000 }
          );
        } catch (retryErr) {
          console.warn("[InProgressApi] www retry also failed:", retryErr.message);
        }
      }
    }

    const result = unwrapInProgressListingsEnvelope(response.data, params.limit);
    return result;
  } catch (err) {
    if (!err.response) {
      throw err;
    }

    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof errBody?.error === "string" && errBody.error) ||
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      errBody?.errorMessage ||
      errBody?.reason ||
      err.message ||
      "Unable to load in-progress listings. Please try again.";

    throw new Error(message);
  }
};

export const fetchInProgressProductDetails = async (tableId) => {
  if (!tableId) throw new Error("Product Table_ID is required.");

  try {
    const response = await axios.get(
      `${BASE_URL_WWW}/sellerProductDetails`,
      { params: { Table_ID: tableId }, timeout: 15_000 }
    );

    const data = response.data;
    const candidates = [
      data?.message?.body?.product,
      data?.message?.data?.product,
      data?.message?.body,
      data?.message?.data,
      data?.body?.product,
      data?.body,
      data?.data,
      data,
    ];

    const details = candidates.find(
      (c) =>
        c &&
        typeof c === "object" &&
        !Array.isArray(c) &&
        (c.name || c.price != null || c.status || c.Table_ID || c._id)
    ) ?? data;

    if (!details || typeof details !== "object") {
      throw new Error("Product not found or response format changed.");
    }

    const normalised = { ...details };

    normalised.Table_ID = normalised.Table_ID || normalised.tableId
      || normalised.table_id || normalised.productId || normalised._id || tableId || "";
    normalised.productId = normalised.productId || normalised.product_id || normalised.wixProductId || "";

    normalised.mainmedia = normalised.mainmedia || normalised.main_media
      || normalised.mainMedia || normalised.mainImage || "";

    normalised.productImages = normalised.productImages || normalised.product_images
      || normalised.images || normalised.mediaItems || [];

    const rawSizeChart = normalised.sizeChart || normalised.size_chart
      || normalised.sizeChartUrl || normalised.size_chart_url
      || normalised.sizeChartImage || "";
    normalised.sizeChart = resolveWixImage(rawSizeChart) || "";

    const rawPromo = normalised.promotionPhotos
      || normalised.promotion_photos || normalised.promoPhotos
      || normalised.promotionImages || [];
    const promoArr = Array.isArray(rawPromo) ? rawPromo : [rawPromo];
    normalised.promotionPhotos = promoArr
      .map(p => {
        if (!p) return null;
        const raw = typeof p === "string" ? p : p.src || p.url || p.image || null;
        return resolveWixImage(raw);
      })
      .filter(Boolean);

    if (!normalised.mediaItems) {
      normalised.mediaItems = normalised.productImages;
    }

    return normalised;
  } catch (err) {
    if (!err.response) throw err;
    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof body?.error === "string" && body.error) ||
      err.message ||
      "Unable to fetch product details.";
    throw new Error(message);
  }
};


/* =============================================================================
  // ONBOARD STATUS APIs
  ============================================================================= */

export const checkOnboardStatus = async (contact) => {
  if (!contact) {
    throw new Error("checkOnboardStatus: contact is required.");
  }

  const trimmed = contact.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const isPhone = /^[6-9]\d{9}$/.test(trimmed);

  let queryParam = "";
  if (isEmail) {
    queryParam = `email=${encodeURIComponent(trimmed)}`;
  } else if (isPhone) {
    queryParam = `phone=${encodeURIComponent(trimmed)}`;
  } else {
    throw new Error("Invalid email or phone number.");
  }

  const url = `${ONBOARD_STATUS_API_URL}?${queryParam}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Onboard status API error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  const rawStatus =
    data.message ??
    data.status ??
    data.onboardingStatus ??
    data.onboardStatus ??
    null;

  if (typeof rawStatus === "string") {
    const s = rawStatus.toLowerCase().trim();

    const ACTIVE_VALUES = new Set(["active", "completed", "complete", "done"]);
    const INACTIVE_VALUES = new Set(["inactive", "incomplete", "pending", "not_completed"]);

    if (ACTIVE_VALUES.has(s)) return true;
    if (INACTIVE_VALUES.has(s)) return false;

    console.warn("checkOnboardStatus: unrecognised status string:", s, "| full response:", data);
    return false;
  }

  if (typeof data.active === "boolean") return data.active;
  if (typeof data.completed === "boolean") return data.completed;
  if (typeof data.onboarded === "boolean") return data.onboarded;

  console.warn("checkOnboardStatus: unknown response shape:", data);
  return false;
};


/* =============================================================================
  // OTP APIs
  ============================================================================= */

export const generateOtp = async (phone) => {
  const res = await fetch(`${SELLER_BASE_URL}/generateotp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    throw new Error("Failed to generate OTP. Please try again.");
  }

  const data = await res.json();

  if (data?.status !== "success") {
    throw new Error(data?.message || "Could not send OTP. Please try again.");
  }

  return data;
};

export const verifyOtp = async (phone, otp) => {
  const res = await fetch(`${SELLER_BASE_URL}/verifyotp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp }),
  });

  if (!res.ok) {
    throw new Error("Verification failed. Please try again.");
  }

  const data = await res.json();

  if (data?.status !== "success") {
    throw new Error(data?.message || "Invalid OTP. Please try again.");
  }

  return data;
};

export const resendOtp = async (phone) => {
  const res = await fetch(`${SELLER_BASE_URL}/resendotp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    throw new Error("Failed to resend OTP. Please try again.");
  }

  const data = await res.json();

  if (data?.status !== "success") {
    throw new Error(data?.message || "Could not resend OTP. Please try again.");
  }

  return data;
};


/* =============================================================================
  // REGISTER APIs
  ============================================================================= */

export const registerUser = async ({ fullName, phone, email, password }) => {
  if (!fullName?.trim()) {
    throw new Error("Please enter your full name.");
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValidEmail) {
    throw new Error("Please enter a valid email address.");
  }

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);
  if (!isValidPhone) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const emailCheck = await checkSeller(email);
  if (emailCheck.userExists) {
    throw new Error("This email is already registered. Please sign in instead.");
  }

  const phoneCheck = await checkSeller(phone);
  if (phoneCheck.userExists) {
    throw new Error("This phone number is already registered. Please sign in instead.");
  }

  const res = await fetch(`${PROFILE_BASE_URL}/registeruser`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: fullName.trim(),
      phone,
      email: email.toLowerCase().trim(),
      password,
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Registration failed. Please try again.");
  }

  if (data?.status === "success") {
    const resolvedSellerId =
      data?.message?.sellerId ||
      data?.message?.body?.sellerId ||
      data?.message?.data?.sellerId ||
      data?.message?.SellerID ||
      data?.message?.body?.SellerID ||
      data?.data?.sellerId ||
      data?.data?.SellerID ||
      data?.seller?.sellerId ||
      data?.SellerID ||
      data?.sellerId ||
      "";

    if (resolvedSellerId) {
      localStorage.setItem("sellerId", String(resolvedSellerId));
      sessionStorage.setItem("sellerId", String(resolvedSellerId));
      localStorage.setItem("__haatza_sellerId", String(resolvedSellerId));
      sessionStorage.setItem("__haatza_sellerId", String(resolvedSellerId));
    }

    return {
      success: true,
      message: data?.message?.message || data?.message || "Account created successfully!",
      sellerId: resolvedSellerId,
    };
  }

  throw new Error(data?.message || "Registration failed. Please try again.");
};


/* =============================================================================
  // SPECIFICATION APIs
  ============================================================================= */

export const fetchCategoryFields = async (categoryId) => {
  let res;
  try {
    res = await fetch(
      `https://haatza.com/_functions/CategoryFields?categoryId=${categoryId}`
    );
  } catch (networkErr) {
    throw new Error(`Network error — check your connection: ${networkErr.message}`);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const raw = Array.isArray(json)
    ? json
    : (json.message?.data || json.data || json.fields || json.items || []);

  return [...raw].sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));
};


/* =============================================================================
  // WALLET APIs
  ============================================================================= */

export const walletService = {
  checkWalletBalance: async (sellerId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/checkWalletBalance`, {
        params: { sellerId },
      });
      return res.data;
    } catch (error) {
      return {
        status: "error",
        message: { RemainingBalance: 0 },
        error: error.message
      };
    }
  },

  transactionHistory: async (sellerId) => {
    const res = await axios.get(`${API_BASE_URL}/transactionHistory`, {
      params: { sellerId },
    });
    return res.data;
  },

  addFunds: async (payload) => {
    _svcLog("[sellerService] addFunds payload:", payload);
    try {
      const res = await axios.post(`${API_BASE_URL}/addFunds`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });
      _svcLog("[sellerService] addFunds response:", res.data);
      return res.data;
    } catch (err) {
      _svcErr("[sellerService] addFunds NETWORK ERROR:", err?.message, err?.response?.status, err?.response?.data);
      throw err;
    }
  },
  createRazorpayOrder: async (payload) => {
    const res = await axios.post(`${API_BASE_URL}/createRazorpayOrder`, payload);
    return res.data;
  },

  verifyRazorpayPayment: async (payload) => {
    console.log("[sellerService] verifyRazorpayPayment payload:", payload);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/verifyRazorpayPayment`,
        payload,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 20000,
          validateStatus: () => true
        }
      );

      console.log("[sellerService] verifyRazorpayPayment status:", res.status);
      console.log("[sellerService] verifyRazorpayPayment response:", res.data);

      if (res.status < 200 || res.status >= 300) {
        const msg =
          res.data?.message ||
          res.data?.error ||
          `verifyRazorpayPayment failed with HTTP ${res.status}`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      return res.data;
    } catch (err) {
      console.error(
        "[sellerService] verifyRazorpayPayment failed:",
        err?.message,
        err?.response?.status,
        err?.response?.data
      );
      throw err;
    }
  },

  getCampaignSummary: async (sellerId) => {
    const res = await axios.get(`${API_BASE_URL}/Campaignsummery`, {
      params: { sellerId }
    });
    return res.data;
  },
};

export const checkWalletBalance = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    return await walletService.checkWalletBalance(resolvedSellerId);
  } catch (error) {
    console.warn("[API Failed]", "checkWalletBalance", error.response?.status, error.response?.data || error.message);
    return {
      status: "error",
      message: { RemainingBalance: 0 },
      error: error.message
    };
  }
};

export const getTransactionHistory = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.transactionHistory(resolvedSellerId);
};

export const addFunds = async (sellerIdOrPayload, amount) => {
  if (typeof sellerIdOrPayload === "object") {
    return walletService.addFunds(sellerIdOrPayload);
  }
  const resolvedSellerId = getOrResolveSellerId(sellerIdOrPayload);
  return walletService.addFunds({ sellerId: resolvedSellerId, amount: Number(amount) });
};

export const getWalletSummary = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    return await walletService.checkWalletBalance(resolvedSellerId);
  } catch (error) {
    console.warn("[API Failed]", "getWalletSummary", error.response?.status, error.response?.data || error.message);
    return {
      status: "error",
      message: { RemainingBalance: 0 },
      error: error.message
    };
  }
};

export const getWalletTransactions = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.transactionHistory(resolvedSellerId);
};

export const getCampaignSpends = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  try {
    const response = await getTransactionHistory(resolvedSellerId);
    if (response && response.message && response.message.transactions) {
      const transactions = response.message.transactions;
      const spends = transactions.filter(tx => {
        const type = String(tx.type || "").toLowerCase();
        return type !== "credit" && type !== "deposit" && type !== "add_funds";
      });
      return {
        status: "success",
        message: { spends }
      };
    }
    return { status: "success", message: { spends: [] } };
  } catch (err) {
    console.error("[sellerService] Failed to fetch campaign spends:", err);
    throw err;
  }
};

export const createWalletOrder = async (sellerId, amount) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.createRazorpayOrder({ sellerId: resolvedSellerId, amount: Number(amount) });
};

export const verifyWalletPayment = async (sellerId, paymentResponse) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.verifyRazorpayPayment({ sellerId: resolvedSellerId, ...paymentResponse });
};

export const fetchWalletBalance = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const data = await walletService.checkWalletBalance(resolvedSellerId);
    return Number(data?.message?.RemainingBalance || data?.RemainingBalance || 0);
  } catch (err) {
    console.error("[fetchWalletBalance] Error fetching balance:", err);
    return 0;
  }
};

export const getSellerTutorials = async () => {
  const response = await axios.get(`${API_BASE_URL}/SellerTutorials`, {
    timeout: 15000,
  });
  return response.data;
};

export const getSellerTickets = async ({ sellerId, emailId, fromDate, toDate }) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const resolvedEmail = emailId || resolveSellerEmailForApi();
    const response = await axios.get(`${API_BASE_URL}/sellertickets`, {
      params: {
        sellerId: resolvedSellerId,
        emailId: resolvedEmail || "",
        email: resolvedEmail || "",
        fromDate,
        toDate
      },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getSellerTickets", error.response?.status, error.response?.data || error.message);
    return { status: "success", tickets: [], data: [], message: { data: [] } };
  }
};

export const getTickets = async (sellerId) => {
  const email = resolveSellerEmailForApi();
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  return getSellerTickets({ sellerId, emailId: email, fromDate, toDate });
};

export const createTicket = async (sellerId, payload) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    `${API_BASE_URL}/createTicket`,
    { sellerId: resolvedSellerId, ...payload },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const getSellerNewOrders = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(`${API_BASE_URL}/sellernewOrders`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getSellerNewOrders", error.response?.status, error.response?.data || error.message);
    return { status: "success", count: 0, data: [], message: [] };
  }
};

export const getSellerPayments = async (arg = {}, config = {}) => {
  const paramsInput = typeof arg === "string" ? { email: resolveSellerEmailForApi() || "" } : arg;
  const { email: sellerEmail, fromDate, toDate, count = 50, lastFetched = 0 } = paramsInput;

  if (!sellerEmail) throw new Error("Missing seller email for sellerpayments");

  const params = {
    email: sellerEmail,
    fromDate,
    toDate,
    count,
    lastFetched,
  };

  console.log("[SettlementsPage] sellerpayments params", params);

  const res = await axios.get("https://haatza.com/_functions/sellerpayments", {
    params,
    ...config,
  });

  console.log("[SettlementsPage] Seller Payments Response", res.data);

  return res.data;
};

export const getSellerConfirmedOrdersCount = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(`${API_BASE_URL}/sellerConfirmedOrdersCount`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getSellerConfirmedOrdersCount", error.response?.status, error.response?.data || error.message);
    return { status: "success", count: 0, message: { count: 0 } };
  }
};

export const getTopSellingProducts = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(`${API_BASE_URL}/getTopSellingProducts`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getTopSellingProducts", error.response?.status, error.response?.data || error.message);
    return { status: "success", data: [], message: [] };
  }
};

export const getProductStats = async (sellerIdOrTableId) => {
  try {
    const params = {};
    if (sellerIdOrTableId && sellerIdOrTableId.startsWith("HS")) {
      params.sellerId = sellerIdOrTableId;
    } else {
      params.tableId = sellerIdOrTableId;
    }
    const response = await axios.get(`${API_BASE_URL}/getProductStats`, {
      params,
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getProductStats", error.response?.status, error.response?.data || error.message);
    return { status: "success", data: {}, message: {} };
  }
};

export const fetchWalletTransactions = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  try {
    const response = await axios.get(`${API_BASE_URL}/transactionHistory`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15_000,
    });
    const rawTx = response.data?.message?.transactions || [];
    return rawTx.map((tx) => {
      const isCredit =
        String(tx.type || "").toLowerCase() === "credit" ||
        String(tx.type || "").toLowerCase() === "deposit" ||
        String(tx.type || "").toLowerCase() === "add_funds";
      let displayDate = "Recent";
      const dateVal = tx.createdDate || tx.date || tx.createdAt;
      if (dateVal) {
        try {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) {
            const options = { day: '2-digit', month: 'short', year: 'numeric' };
            displayDate = d.toLocaleDateString('en-GB', options);
          }
        } catch (e) {
          displayDate = String(dateVal);
        }
      }
      return {
        id: tx._id || tx.id || String(Math.random()),
        date: displayDate,
        type: tx.type || "Transaction",
        amount: Number(tx.amount || 0),
        isCredit,
        status: tx.status || "Completed",
      };
    });
  } catch (err) {
    console.error("[fetchWalletTransactions] Error fetching transactions:", err);
    throw new Error("Unable to load transaction records.");
  }
};

export const addFundsToWallet = async (sellerId, amount, razorpayResponse = {}) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);

  const payload = {
    sellerId: resolvedSellerId,
    amountAdded: Number(amount),
    paymentId: razorpayResponse.razorpay_payment_id || razorpayResponse.paymentId
  };

  console.log("[WalletPage] Add Funds Payload", payload);

  try {
    const response = await axios.post(`${API_BASE_URL}/addFunds`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    console.log("[WalletPage] Add Funds Response", response.data);

    return response.data;
  } catch (err) {
    console.error(
      "[addFundsToWallet] Error:",
      err?.response?.status,
      err?.response?.data || err.message
    );

    throw new Error(
      err.response?.data?.error ||
      err.response?.data?.message ||
      "Failed to complete wallet credit."
    );
  }
};
/* =============================================================================
  // ADVERTISEMENT APIs
  ============================================================================= */

export const getAdvertisements = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(SELLER_CAMPAIGNS_API, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const getAdvertisementSummary = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(CAMPAIGN_SUMMARY_API, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getAdvertisementSummary", error.response?.status, error.response?.data || error.message);
    return { status: "success", data: {}, message: {} };
  }
};
export const getSellerCampaigns = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const res = await axios.get(`${API_BASE_URL}/sellerCampaigns`, {
    params: { sellerId: resolvedSellerId }
  });
  return res.data;
};

export const getCampaignDetails = async (tableId, fromAndToDate = "") => {
  let params = { tableId };
  if (fromAndToDate) {
    if (typeof fromAndToDate === "string") {
      const searchParams = new URLSearchParams(fromAndToDate.startsWith("&") ? fromAndToDate.substring(1) : fromAndToDate);
      for (const [key, val] of searchParams.entries()) {
        params[key] = val;
      }
    } else if (typeof fromAndToDate === "object") {
      params = { ...params, ...fromAndToDate };
    }
  }
  const res = await axios.get(`${API_BASE_URL}/campaignDetails`, {
    params
  });
  return res.data;
};

export const getCampaignSummary = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const res = await axios.get(`${API_BASE_URL}/Campaignsummery`, {
    params: { sellerId: resolvedSellerId }
  });
  return res.data;
};
export const getAdvertisementPerformance = async (sellerId, campaignId, fromAndToDate = "") => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const params = { tableId: campaignId, sellerId: resolvedSellerId };

  let parsedParams = { ...params };
  if (fromAndToDate) {
    if (typeof fromAndToDate === "string") {
      const searchParams = new URLSearchParams(fromAndToDate);
      for (const [key, val] of searchParams.entries()) {
        parsedParams[key] = val;
      }
    } else if (typeof fromAndToDate === "object") {
      parsedParams = { ...parsedParams, ...fromAndToDate };
    }
  }

  const response = await axios.get(CAMPAIGN_DETAILS_API, {
    params: parsedParams,
    timeout: 15000,
  });
  return response.data;
};

export const getAdvertisementAnalytics = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(CAMPAIGN_SUMMARY_API, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const createAdvertisement = async (sellerId, adData) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    NEW_SELLER_CAMPAIGN_API,
    { sellerId: resolvedSellerId, ...adData },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const pauseAdvertisement = async (sellerId, campaignId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    OFF_SELLER_CAMPAIGN_API,
    { sellerId: resolvedSellerId, campaignId },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const resumeAdvertisement = async (sellerId, campaignId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    UPDATE_SELLER_CAMPAIGN_API,
    { sellerId: resolvedSellerId, campaignId, status: "active" },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const deleteAdvertisement = async (sellerId, campaignId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    DELETE_SELLER_CAMPAIGN_API,
    { sellerId: resolvedSellerId, campaignId },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const getCampaigns = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerCampaigns`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const CAMPAIGN_TYPE_OPTIONS = [
  {
    id: "smart",
    name: "Smart Campaign",
    recommended: true,
    isAvailable: true,
    description: "You choose the products manually, and we optimize the performance."
  },
  {
    id: "manual",
    name: "Manual Campaign",
    recommended: false,
    isAvailable: false,
    description: "Currently unavailable"
  }
];

export const DAILY_BUDGET_OPTIONS = [250, 550, 700];

export const getPromotedProducts = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const getNotPromotedProducts = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const email = resolveSellerEmailForApi();
  if (!email) {
    return { status: "success", data: [], products: [] };
  }

  const productsResponse = await axios.get(`${API_BASE_URL}/seller_products`, {
    params: { email, page: 1, limit: 100 },
    timeout: 15000,
  });

  let promotedList = [];
  try {
    const promotedResponse = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    const rawPromoted = promotedResponse.data?.data || promotedResponse.data?.products || promotedResponse.data || [];
    promotedList = Array.isArray(rawPromoted) ? rawPromoted : [];
  } catch (err) {
    console.warn("Failed to fetch promoted products for filtering:", err);
  }

  const allProductsRaw = productsResponse.data?.data || productsResponse.data?.products || productsResponse.data || [];
  const allProducts = Array.isArray(allProductsRaw) ? allProductsRaw : [];

  const promotedIds = new Set(promotedList.map(p => String(p.id || p._id || p.productId)));
  const notPromoted = allProducts.filter(p => !promotedIds.has(String(p.id || p._id)));

  return {
    status: "success",
    data: notPromoted,
    products: notPromoted
  };
};

export const getCampaignTypes = async () => {
  return {
    status: "success",
    message: {
      campaignTypes: CAMPAIGN_TYPE_OPTIONS,
      types: CAMPAIGN_TYPE_OPTIONS
    },
    types: CAMPAIGN_TYPE_OPTIONS
  };
};

export const getBudgetOptions = async () => {
  return {
    status: "success",
    message: {
      budgetOptions: DAILY_BUDGET_OPTIONS,
      budgets: DAILY_BUDGET_OPTIONS
    },
    budgets: DAILY_BUDGET_OPTIONS
  };
};

export const createCampaign = async (payload) => {
  if (payload && payload.sellerId) {
    payload.sellerId = getOrResolveSellerId(payload.sellerId);
  }
  const response = await axios.post(`${API_BASE_URL}/newSellerCampaign`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const pauseCampaign = async (id, sellerId = null) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    `${API_BASE_URL}/offSellerCampaign`,
    { campaignId: id, sellerId: resolvedSellerId },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const resumeCampaign = async (id, sellerId = null) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    `${API_BASE_URL}/updateSellerCampaign`,
    { campaignId: id, sellerId: resolvedSellerId, status: "active" },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const deleteCampaign = async (id, sellerId = null) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    `${API_BASE_URL}/deleteSellerCampaign`,
    { campaignId: id, sellerId: resolvedSellerId },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};


/* =============================================================================
  // HAATZUP APIs
  ============================================================================= */

export const getSellerHaatzupProducts = async (sellerId, page = 1, limit = 15) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerhaatzupProducts`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const getSellerwiseHaatzUp = async (sellerId, page = 1, limit = 12) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/SellerwiseHaatzUp`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const uploadHaatzupVideo = async (formData, onUploadProgress = null) => {
  if (formData && formData.has && formData.has("sellerId")) {
    const rawSid = formData.get("sellerId");
    formData.set("sellerId", getOrResolveSellerId(rawSid));
  }
  const response = await axios.post(`${API_BASE_URL}/uploadhaatzupVideo`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 60000,
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percentCompleted);
      }
    },
  });
  return response.data;
};

export const deleteHaatzupVideo = async (sellerId, videoId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    `${API_BASE_URL}/deletehaatzupVideo`,
    { sellerId: resolvedSellerId, videoId },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const getSellerHaatzUpDetails = async (sellerId, videoId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerHaatzUpdetails`, {
    params: { sellerId: resolvedSellerId, videoId },
    timeout: 15000,
  });
  return response.data;
};

export const generateHashtags = async (sellerId, query) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/generateHashtags`, {
    params: { sellerId: resolvedSellerId, query },
    timeout: 15000,
  });
  return response.data;
};

export const getHaatzUpGuidelines = async () => {
  return {
    status: "success",
    message: {
      guidelines: [
        "Reel length must be between 15 and 60 seconds.",
        "Ensure high resolution vertical video (1080x1920, 9:16 aspect ratio).",
        "Avoid copyright background music. Use royalty-free music.",
        "Highlight your product clearly in the first 3 seconds of the reel.",
        "Keep captions descriptive and use relevant tags."
      ]
    }
  };
};

export const getHaatzUpSummary = async (sellerId) => {
  try {
    const response = await getSellerwiseHaatzUp(sellerId);
    const videos = response?.data || response?.message?.videos || response?.videos || [];
    const videosList = Array.isArray(videos) ? videos : [];

    const totalViews = videosList.reduce((sum, v) => sum + Number(v.views || v.totalViews || 0), 0);
    const totalLikes = videosList.reduce((sum, v) => sum + Number(v.likes || v.totalLikes || 0), 0);
    const totalComments = videosList.reduce((sum, v) => sum + Number(v.comments || v.totalComments || 0), 0);

    return {
      status: "success",
      data: {
        totalViews,
        totalLikes,
        totalComments,
        uploadedCount: videosList.length
      }
    };
  } catch (err) {
    console.warn("getHaatzUpSummary failed, returning zeroed stats:", err);
    return {
      status: "success",
      data: {
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        uploadedCount: 0
      }
    };
  }
};

export const getPromotionalVideos = getSellerwiseHaatzUp;
export const getProductsForPromotion = getSellerHaatzupProducts;
export const uploadHaatzUpReel = uploadHaatzupVideo;


/* =============================================================================
  // NOTIFICATION APIs
  ============================================================================= */

export const getNotifications = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(NOTIFICATIONS_API, {
      params: { sellerId: resolvedSellerId },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getNotifications", error.response?.status, error.response?.data || error.message);
    return { status: "success", data: [], message: { data: [] } };
  }
};

export const updateNotificationStatus = async (sellerId, notificationId, status = "read") => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    UPDATE_NOTIFICATION_API,
    { sellerId: resolvedSellerId, notificationId, status },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const markNotificationAsRead = async (sellerId, id) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return updateNotificationStatus(resolvedSellerId, id, "read");
};

export const markAllNotificationsAsRead = async (sellerId, notificationIds = []) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const promises = notificationIds.map(id =>
    updateNotificationStatus(resolvedSellerId, id, "read")
  );
  await Promise.all(promises);
  return { status: "success" };
};

export const fetchNotificationsList = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  try {
    const response = await axios.get(`${API_BASE_URL}/notifications`, {
      params: { sellerId: resolvedSellerId },
      timeout: 10_000,
    });
    const rawNotif = response.data?.message?.data || [];
    return rawNotif.map((n) => ({
      id: n._id || n.id || String(Math.random()),
      title: n.title || "Notification Alert",
      message: n.message || n.body || "",
      time: n.time || "Recently",
      read: Boolean(n.read || n.status === "read"),
      type: n.type || "system",
    }));
  } catch (err) {
    console.error("[fetchNotificationsList] Error loading alerts:", err);
    throw new Error("Unable to fetch notifications.");
  }
};


/* =============================================================================
  // AUDITED BACKEND API INTEGRATIONS
  ============================================================================= */

export const fetchPricingplans = async () => {
  const response = await axios.get(`${PROFILE_BASE_URL}/getPlans`, { timeout: 15000 });
  return response.data;
};

export const getCampaignProducts = async (campaignId) => {
  const response = await axios.get(`${API_BASE_URL}/CampaignProducts`, {
    params: { campaignId },
    timeout: 15000,
  });
  return response.data;
};

export const getCampaignProductPerformance = async (campaignId, productId) => {
  const response = await axios.get(`${API_BASE_URL}/CampaignproductPerformance`, {
    params: { campaignId, productId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchSubscriptionPlan = async (email) => {
  const response = await axios.get(`${PROFILE_BASE_URL}/sellersubscription`, {
    params: { email },
    timeout: 15000,
  });
  return response.data;
};

export const fetchInvoiceData = async (sellerId, page = 1, count = 10) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${PROFILE_BASE_URL}/sellerInvoices`, {
    params: { sellerId: resolvedSellerId, page, count },
    timeout: 15000,
  });
  return response.data;
};

export const activeCoupons = async () => {
  const response = await axios.get(`${API_BASE_URL}/activeCoupons`, { timeout: 15000 });
  return response.data;
};

export const fetchAllCategory = async (search = "", page = 1, count = 30) => {
  const response = await axios.get(`${API_BASE_URL}/subcategorylist`, {
    params: { search, page, count },
    timeout: 15000,
  });
  return response.data;
};

export const fetchSearchAllCategory = async (search = "") => {
  const response = await axios.get(`${API_BASE_URL}/searchcategorylist`, {
    params: { search },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReferalTransactions = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${PROFILE_BASE_URL}/referralWithdraw`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchOrderDetails = async (tableId) => {
  const response = await axios.get(`${API_BASE_URL}/sellerOrderdetails`, {
    params: { tableId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReturnData = async (sellerId, page = 1, count = 50) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/returns`, {
    params: { sellerId: resolvedSellerId, page, count },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReturnDetails = async (tableId) => {
  const response = await axios.get(`${API_BASE_URL}/sellerreturnDetails`, {
    params: { TableID: tableId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchClaimTrackingData = async (sellerId, page = 1, limit = 10) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/SellerClaimslist`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReturnExchangeOrders = async (sellerId, page = 1, limit = 10) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/SellerReturnExchangeOrders`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const appUpdate = async (version) => {
  const response = await axios.get(`${PROFILE_BASE_URL}/sellercheckVersion`, {
    params: { currentversion: version },
    timeout: 10000,
  });
  return response.data;
};

export const createExchangeOrderFun = async (params) => {
  const response = await axios.post(`${API_BASE_URL}/ExchangecreateShipment`, params, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const fetchShipmentData = async (trackingId) => {
  const response = await axios.get(`${API_BASE_URL}/trackshipping`, {
    params: { waybill: trackingId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReferralCheck = async (enteredCouponCode) => {
  const response = await axios.get(`${PROFILE_BASE_URL}/referralCheck`, {
    params: { referralCode: enteredCouponCode },
    timeout: 15000,
  });
  return response.data;
};

export const createRazorPayOrder = async (params) => {
  const resolvedSellerId = getOrResolveSellerId(params?.sellerId);
  const response = await axios.post(`${API_BASE_URL}/createRazorpayOrder`, { ...params, sellerId: resolvedSellerId }, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const createRazorpayOrder = createRazorPayOrder;

export const verifyRazorpayPayment = async (params) => {
  const resolvedSellerId = getOrResolveSellerId(params?.sellerId);
  const response = await axios.post(`${API_BASE_URL}/verifyRazorpayPayment`, { ...params, sellerId: resolvedSellerId }, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const createSubscription = async (params) => {
  const response = await axios.post(`${PROFILE_BASE_URL}/processSubscriptionOrder`, params, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const getVideoResponse = async (guid) => {
  const response = await axios.get(`https://video.bunnycdn.com/library/583918/videos/${guid}`, {
    timeout: 15000,
  });
  return response.data;
};

export const fetchSellerCampaignProduct = async (sellerId, page = 1, query = "") => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const params = { sellerId: resolvedSellerId, page, limit: 30 };
  if (query) {
    params.search = query;
  }
  const response = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
    params,
    timeout: 15000,
  });
  return response.data;
};

export const fetchOrders = async (email, fromDate, toDate, count = 30, lastFetched = 0) => {
  const response = await axios.get(`${API_BASE_URL}/sellernewOrders`, {
    params: { email, fromdate: fromDate, todate: toDate, count, lastFetched },
    timeout: 15000,
  });
  return response.data;
};

export const fetchSellerOrders = async (sellerId, fromdate, toDate, page = 1, count = 30) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellernewOrders`, {
    params: { sellerId: resolvedSellerId, fromdate, todate: toDate, page, count },
    timeout: 15000,
  });
  return response.data;
};


/* =============================================================================
  // EXTRA SYSTEM / COMPATIBILITY APIs
  ============================================================================= */

export const getDashboardDrawerMenu = async () => {
  return {
    status: "success",
    menu: [
      { key: "dashboard", label: "Dashboard", route: "/dashboard" },
      { key: "help", label: "Help", route: "/help" },
      {
        heading: "Boost Sales",
        items: [
          { key: "advertisement", label: "Advertisement", route: "/advertisement" },
          { key: "haatzup", label: "HaatzUp", route: "/haatzup" },
          { key: "growplan", label: "Grow Plan", route: "/growplan" },
          { key: "productinsight", label: "Product Insight", route: "/productinsight" },
          { key: "warehouse", label: "Warehouse", route: "/warehouse" },
          { key: "influencer", label: "Influencer Branding", route: "/influencer" },
          { key: "growthcentral", label: "Growth Central", route: "/growthcentral" },
          { key: "qualityinsights", label: "Quality Insights", route: "/qualityinsights" },
          { key: "referandearn", label: "Refer & Earn", route: "/referandearn" }
        ]
      }
    ]
  };
};


/* =============================================================================
  DUAL PATTERN EXPORTS
  ============================================================================= */

export const sellerService = {
  fetchInventoryData,
  getSellerProductInventory,
  incrementInventory,
  decrementInventory,
  checkWalletBalance,
  getTransactionHistory,
  addFunds,
  getNotifications,
  updateNotificationStatus,
  getWalletSummary,
  getWalletTransactions,
  getCampaignSpends,
  createWalletOrder,
  verifyWalletPayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getDashboardDrawerMenu,
  getUserProfile,
  getTickets,
  getSellerTickets,
  createTicket,
  getAdvertisements,
  getAdvertisementSummary,
  getCampaignSummary,
  getSellerCampaigns,
  getCampaignDetails,
  getAdvertisementPerformance,
  getAdvertisementAnalytics,
  createAdvertisement,
  pauseAdvertisement,
  resumeAdvertisement,
  deleteAdvertisement,
  checkSeller,
  fetchSellerDetails,
  getCachedSellerId,
  getCachedSellerPinCode,
  fetchCategories,
  fetchSubcategoriesFirstPage,
  fetchSubcategoriesPaged,
  fetchSubcategories,
  searchCategories,
  searchSubcategories,
  normalizeSearchText,
  checkGSTINExists,
  updateInventoryStock,
  createListing,
  updateListing,
  buildCreatePayload,
  buildUpdatePayload,
  fetchSettlementSummary,
  getSettlementSummary,
  normalizeSettlementSummary,
  resolveWixImage,
  buildMediaItems,
  buildPromotionPhotos,
  buildDiscount,
  resolveProductReturn,
  buildAdditionalInfoSections,
  buildProductOptions,
  buildVarientPrice,
  resolveSizeChartUrl,
  fetchSellerListings,
  fetchProductDetails,
  fetchInProgressListings,
  fetchInProgressProductDetails,
  checkOnboardStatus,
  generateOtp,
  verifyOtp,
  resendOtp,
  registerUser,
  fetchCategoryFields,
  getCampaigns,
  getPromotedProducts,
  getNotPromotedProducts,
  getCampaignTypes,
  getBudgetOptions,
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  getHaatzUpSummary,
  getPromotionalVideos,
  getHaatzUpGuidelines,
  getProductsForPromotion,
  uploadHaatzUpReel,
  fetchWalletBalance,
  fetchWalletTransactions,
  addFundsToWallet,
  fetchNotificationsList,
  getSellerTutorials,
  getSellerNewOrders,
  getSellerPayments,
  getSellerConfirmedOrdersCount,
  getTopSellingProducts,
  getProductStats,
  deleteHaatzupVideo,
  getSellerHaatzUpDetails,
  generateHashtags,
  resolveSellerId,
  fetchPricingplans,
  getCampaignProducts,
  getCampaignProductPerformance,
  fetchSubscriptionPlan,
  fetchInvoiceData,
  activeCoupons,
  fetchAllCategory,
  fetchSearchAllCategory,
  fetchReferalTransactions,
  fetchOrderDetails,
  fetchReturnData,
  fetchReturnDetails,
  fetchClaimTrackingData,
  fetchReturnExchangeOrders,
  appUpdate,
  createExchangeOrderFun,
  fetchShipmentData,
  fetchReferralCheck,
  createRazorPayOrder,
  createSubscription,
  getVideoResponse,
  fetchSellerCampaignProduct,
  fetchOrders,
  fetchSellerOrders
};


export const advertisementService = {
  getAdvertisementSummary,
  getCampaigns,
  getPromotedProducts,
  getNotPromotedProducts,
  getCampaignTypes,
  getBudgetOptions,
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign
};

export const haatzupService = {
  getHaatzUpSummary,
  getPromotionalVideos,
  getHaatzUpGuidelines,
  getProductsForPromotion,
  uploadHaatzUpReel
};

export {
  SELLER_PRODUCT_INVENTORY_API,
  INCREMENT_INVENTORY_API,
  DECREMENT_INVENTORY_API,
  CHECK_WALLET_BALANCE_API,
  TRANSACTION_HISTORY_API,
  ADD_FUNDS_API,
  NOTIFICATIONS_API,
  UPDATE_NOTIFICATION_API,

};

export default sellerService;
