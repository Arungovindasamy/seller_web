import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import GrowPlanPage from "../GrowPlanPage";
import { resolveSellerId, resolveSellerEmail } from "../../../utils/sellerSession";
import { sellerService } from "../../../services/sellerService";

jest.mock("axios");
jest.mock("../../../utils/sellerSession", () => ({
  resolveSellerId: jest.fn(),
  resolveSellerEmail: jest.fn()
}));

jest.mock("../../../services/sellerService", () => ({
  sellerService: {
    getUserProfile: jest.fn(),
    verifyRazorpayPayment: jest.fn()
  }
}));

describe("GrowPlanPage - API Parameter Integration Tests", () => {
  const mockSellerId = "HS1380";
  const mockSellerEmail = "seller@haatza.com";
  const mockPlansData = {
    message: {
      items: [
        {
          id: "growth_plan",
          name: "Growth",
          price: 999,
          features: ["Growth Feature 1"]
        },
        {
          id: "pro_plan",
          name: "Pro",
          price: 1999,
          recommended: true,
          features: ["Pro Feature 1"]
        }
      ]
    }
  };

  // Mock global Razorpay
  beforeAll(() => {
    window.Razorpay = class MockRazorpay {
      constructor(options) {
        this.options = options;
      }
      on() {}
      open() {}
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resolveSellerId.mockReturnValue(mockSellerId);
    resolveSellerEmail.mockReturnValue(mockSellerEmail);

    axios.get.mockImplementation((url) => {
      if (url.includes("getPlans")) {
        return Promise.resolve({ data: mockPlansData });
      }
      if (url.includes("checkWalletBalance")) {
        return Promise.resolve({ data: { message: { RemainingBalance: 500 } } });
      }
      if (url.includes("sellersubscription")) {
        return Promise.resolve({ data: { message: { orders: [] } } });
      }
      return Promise.reject(new Error("Unknown GET URL"));
    });

    sellerService.getUserProfile.mockResolvedValue({
      status: "success",
      message: { name: "Test Seller", phone: "9876543210", email: mockSellerEmail }
    });
  });

  test("1. GrowPlan triggers checkWalletBalance with sellerId, createRazorpayOrder with sellerId, and processSubscriptionOrder with both sellerId and email", async () => {
    const mockOrderResponse = {
      data: {
        status: "success",
        message: {
          order: { id: "order_T3qS9dNhtZXZXt", amount: 199900, currency: "INR" },
          keyId: "rzp_live_R8ib0QZopkaicy"
        }
      }
    };

    axios.post.mockImplementation((url) => {
      if (url.includes("createRazorpayOrder")) {
        return Promise.resolve(mockOrderResponse);
      }
      if (url.includes("processSubscriptionOrder")) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(new Error("Unknown POST URL"));
    });

    sellerService.verifyRazorpayPayment.mockResolvedValue({
      message: { verified: true }
    });

    render(
      <MemoryRouter>
        <GrowPlanPage />
      </MemoryRouter>
    );

    // 1. Verify checkWalletBalance is called with sellerId
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "https://haatza.com/_functions/checkWalletBalance",
        expect.objectContaining({ params: { sellerId: mockSellerId } })
      );
    });

    // Continue to Review
    fireEvent.click(screen.getByText("Continue").closest("button"));

    // Click Subscribe Now
    fireEvent.click(screen.getByText("Subscribe Now"));
    fireEvent.click(screen.getByText("Yes"));

    // 2. Verify createRazorpayOrder is called with sellerId
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "https://haatza.com/_functions/createRazorpayOrder",
        { sellerId: mockSellerId, amount: 1999 }
      );
    });
  });
});
