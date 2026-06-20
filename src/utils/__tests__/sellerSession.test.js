import { resolveSellerId, getSellerId, resolveSellerEmail } from "../sellerSession";

describe("sellerSession Utility Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test("1. resolves sellerId from canonical storage key __haatza_sellerId", () => {
    localStorage.setItem("__haatza_sellerId", "HS1380");
    expect(resolveSellerId()).toBe("HS1380");
    expect(getSellerId()).toBe("HS1380");
  });

  test("2. resolves sellerId from fallback key sellerId in sessionStorage", () => {
    sessionStorage.setItem("sellerId", "HS1018");
    expect(resolveSellerId()).toBe("HS1018");
  });

  test("3. parses JSON auth structures to find nested sellerId", () => {
    const authObj = {
      user: {
        sellerId: "HS9999"
      }
    };
    localStorage.setItem("user", JSON.stringify(authObj));
    expect(resolveSellerId()).toBe("HS9999");
  });

  test("4. resolves sellerEmail correctly from different keys", () => {
    localStorage.setItem("userEmail", "test@haatza.com");
    expect(resolveSellerEmail()).toBe("test@haatza.com");
  });

  test("5. parses nested auth object for email", () => {
    const sessionObj = {
      seller: {
        email: "nested@haatza.com"
      }
    };
    localStorage.setItem("session", JSON.stringify(sessionObj, null, 2));
    expect(resolveSellerEmail()).toBe("nested@haatza.com");
  });

  test("6. resolveSellerId must not return email from user/userEmail/email keys", () => {
    sessionStorage.setItem("user", "teezaastyleyourtees@gmail.com");
    localStorage.setItem("userEmail", "teezaastyleyourtees@gmail.com");
    localStorage.setItem("email", "teezaastyleyourtees@gmail.com");
    const staleUserData = {
      userEmail: "wrong_id_is_email@haatza.com"
    };
    sessionStorage.setItem("userData", JSON.stringify(staleUserData));

    expect(resolveSellerId()).toBe("");
  });

  test("7. empty storage returns empty string safely", () => {
    expect(resolveSellerId()).toBe("");
    expect(resolveSellerEmail()).toBe("");
  });
});
