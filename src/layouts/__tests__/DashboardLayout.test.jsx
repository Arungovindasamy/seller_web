import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "../../components/Layout/DashboardLayout/DashboardLayout";
import { sellerService } from "../../services/sellerService";
import { getSellerId } from "../../utils/sellerSession";

// Setup global matchMedia mock
beforeAll(() => {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });
});

jest.mock("../../services/sellerService", () => ({
  sellerService: {
    getUserProfile: jest.fn(),
    getCachedSellerPinCode: jest.fn().mockReturnValue("560001"),
    checkWalletBalance: jest.fn().mockResolvedValue({ message: { RemainingBalance: 0 } }),
    getSellerNewOrders: jest.fn().mockResolvedValue({ count: 0, data: [] }),
    getSellerTickets: jest.fn().mockResolvedValue({ message: { data: [] } }),
    getNotifications: jest.fn().mockResolvedValue({ message: { data: [] } }),
    getAdvertisementSummary: jest.fn().mockResolvedValue({ activeCampaigns: 0 })
  }
}));

jest.mock("../../utils/sellerSession", () => ({
  getSellerId: jest.fn()
}));

describe("DashboardLayout - Session Propagation Tests", () => {
  const mockSellerId = "HS1380";
  const mockEmail = "seller@haatza.com";

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    getSellerId.mockReturnValue(mockSellerId);

    sellerService.getUserProfile.mockResolvedValue({
      status: "success",
      sellerId: mockSellerId,
      sellerName: "Test Seller",
      phone: "9876543210",
      email: mockEmail,
      message: [
        {
          sellerId: mockSellerId,
          sellerName: "Test Seller",
          phone: "9876543210",
          email: mockEmail
        }
      ]
    });
  });

  test("1. DashboardLayout retrieves email, gets profile, and sets sellerId in localStorage and sessionStorage", async () => {
    // Put email in storage so it gets resolved
    localStorage.setItem("userEmail", mockEmail);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<div>Dashboard Child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Wait for the profile call
    await waitFor(() => {
      expect(sellerService.getUserProfile).toHaveBeenCalledWith(mockEmail);
    });

    // Check that layout stored the resolved sellerId
    await waitFor(() => {
      expect(localStorage.getItem("sellerId")).toBe(mockSellerId);
      expect(sessionStorage.getItem("sellerId")).toBe(mockSellerId);
      expect(localStorage.getItem("__haatza_sellerId")).toBe(mockSellerId);
      expect(sessionStorage.getItem("__haatza_sellerId")).toBe(mockSellerId);
    });
  });
});
