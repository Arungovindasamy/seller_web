const CANONICAL_SELLER_KEY = "__haatza_sellerId";

/**
 * Resolves the logged-in seller's ID from session/local storage.
 * @returns {string} The active seller ID.
 */
export const resolveSellerId = () => {
  if (typeof window === "undefined") return "";

  const isValidSellerId = (val) => {
    if (!val || typeof val !== "string") return false;
    const trimmed = val.trim();
    return !trimmed.includes("@") && (trimmed.startsWith("HS") || trimmed.length >= 2);
  };

  const keys = [
    CANONICAL_SELLER_KEY,
    "sellerId",
    "seller_id",
    "userId",
    "user_id",
    "user",
    "authUser",
    "currentUser",
    "userData",
    "sellerData",
    "auth",
    "session"
  ];

  for (const key of keys) {
    // 1. Session Storage
    const sessionVal = sessionStorage.getItem(key);
    if (sessionVal && sessionVal.trim().length >= 2) {
      const val = sessionVal.trim();
      if (!val.startsWith("{") && !val.startsWith("[")) {
        if (isValidSellerId(val)) return val;
      } else {
        try {
          const obj = JSON.parse(val);
          const id =
            obj?.sellerId ||
            obj?.seller_id ||
            obj?.userId ||
            obj?.user_id ||
            obj?.user?.sellerId ||
            obj?.user?.seller_id ||
            obj?.data?.sellerId ||
            obj?.data?.seller_id ||
            obj?.seller?.sellerId ||
            obj?.seller?.seller_id ||
            obj?.id ||
            obj?.uid;
          if (isValidSellerId(id)) return id.trim();
        } catch {}
      }
    }

    // 2. Local Storage
    const localVal = localStorage.getItem(key);
    if (localVal && localVal.trim().length >= 2) {
      const val = localVal.trim();
      if (!val.startsWith("{") && !val.startsWith("[")) {
        if (isValidSellerId(val)) return val;
      } else {
        try {
          const obj = JSON.parse(val);
          const id =
            obj?.sellerId ||
            obj?.seller_id ||
            obj?.userId ||
            obj?.user_id ||
            obj?.user?.sellerId ||
            obj?.user?.seller_id ||
            obj?.data?.sellerId ||
            obj?.data?.seller_id ||
            obj?.seller?.sellerId ||
            obj?.seller?.seller_id ||
            obj?.id ||
            obj?.uid;
          if (isValidSellerId(id)) return id.trim();
        } catch {}
      }
    }
  }

  return "";
};

/**
 * Sync function mapping to the centralized resolver
 */
export const getSellerId = () => resolveSellerId();

/**
 * Resolves the logged-in seller's email address from session/local storage.
 * @returns {string} The active email address.
 */
export const resolveSellerEmail = () => {
  if (typeof window === "undefined") return "";

  const keys = [
    "pendingEmail", "userEmail", "email", "sellerEmail",
    "user_email", "seller_email", "currentUserEmail",
    "user", "authUser", "currentUser", "userData", "sellerData",
    "auth", "session", "loginData", "accountData",
  ];
  const emailFields = [
    "email", "userEmail", "sellerEmail", "user_email",
    "seller_email", "emailAddress", "loginEmail",
  ];
  const isValidEmail = (v) => v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

  for (const key of keys) {
    const sessionVal = sessionStorage.getItem(key);
    if (sessionVal) {
      if (isValidEmail(sessionVal)) return sessionVal.trim().toLowerCase();
      try {
        const parsed = JSON.parse(sessionVal);
        for (const field of emailFields) {
          if (isValidEmail(parsed?.[field])) return String(parsed[field]).trim().toLowerCase();
        }
      } catch {}
    }

    const localVal = localStorage.getItem(key);
    if (localVal) {
      if (isValidEmail(localVal)) return localVal.trim().toLowerCase();
      try {
        const parsed = JSON.parse(localVal);
        for (const field of emailFields) {
          if (isValidEmail(parsed?.[field])) return String(parsed[field]).trim().toLowerCase();
        }
        for (const nest of ["user", "data", "account", "seller", "profile"]) {
          if (parsed?.[nest] && typeof parsed[nest] === "object") {
            for (const field of emailFields) {
              if (isValidEmail(parsed[nest][field])) {
                return String(parsed[nest][field]).trim().toLowerCase();
              }
            }
          }
        }
      } catch {}
    }
  }

  return "";
};
