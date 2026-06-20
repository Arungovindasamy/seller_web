import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "../DashboardPage";
import { getSellerId } from "../../../utils/sellerSession";
import { sellerService } from "../../../services/sellerService";
import fs from "fs";
import path from "path";

jest.mock("../../../utils/sellerSession", () => ({
  getSellerId: jest.fn()
}));

jest.mock("../../../services/sellerService", () => ({
  sellerService: {
    getUserProfile: jest.fn(),
    getSellerNewOrders: jest.fn(),
    getSellerConfirmedOrdersCount: jest.fn(),
    checkWalletBalance: jest.fn(),
    getNotifications: jest.fn(),
    getAdvertisementSummary: jest.fn(),
    getTopSellingProducts: jest.fn(),
    getProductStats: jest.fn(),
    getSellerPayments: jest.fn()
  }
}));

describe("DashboardPage - Architecture and Parameter Tests", () => {
  const mockSellerId = "HS9999";
  const mockEmail = "seller@haatza.com";

  beforeEach(() => {
    jest.clearAllMocks();
    getSellerId.mockReturnValue(mockSellerId);
    
    // Set storage values
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === "userEmail") return mockEmail;
      return null;
    });

    // Default mock return values
    sellerService.getUserProfile.mockResolvedValue({ message: { sellerName: "Test Seller Store" } });
    sellerService.getSellerNewOrders.mockResolvedValue({ count: 5, data: [] });
    sellerService.getSellerConfirmedOrdersCount.mockResolvedValue({ count: 12 });
    sellerService.checkWalletBalance.mockResolvedValue({ message: { RemainingBalance: 1500 } });
    sellerService.getNotifications.mockResolvedValue({ message: { data: [] } });
    sellerService.getAdvertisementSummary.mockResolvedValue({ activeCampaigns: 2 });
    sellerService.getTopSellingProducts.mockResolvedValue([]);
    sellerService.getProductStats.mockResolvedValue({ totalProducts: 10, activeListings: 8 });
    sellerService.getSellerPayments.mockResolvedValue([]);
  });

  test("1. Dashboard fetches all metrics using the active sellerId and email", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome back, Test Seller Store! ✨")).toBeInTheDocument();
    });

    // Check that sellerId-based APIs were called with our mockSellerId
    expect(sellerService.getSellerNewOrders).toHaveBeenCalledWith(mockSellerId);
    expect(sellerService.getSellerConfirmedOrdersCount).toHaveBeenCalledWith(mockSellerId);
    expect(sellerService.checkWalletBalance).toHaveBeenCalledWith(mockSellerId);
    expect(sellerService.getNotifications).toHaveBeenCalledWith(mockSellerId);
    expect(sellerService.getAdvertisementSummary).toHaveBeenCalledWith(mockSellerId);
    expect(sellerService.getTopSellingProducts).toHaveBeenCalledWith(mockSellerId);
    expect(sellerService.getProductStats).toHaveBeenCalledWith(mockSellerId);
    
    // Check email-based APIs
    expect(sellerService.getUserProfile).toHaveBeenCalledWith(mockEmail);
    expect(sellerService.getSellerPayments).toHaveBeenCalledWith({ email: mockEmail });
  });

  test("2. Dashboard handles React StrictMode duplicate mounts cleanly", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Unmount and remount (StrictMode emulation)
    unmount();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Test Seller Store/)).toBeInTheDocument();
    });
  });

  test("3. Dashboard enters error state when session (sellerId or email) is missing", async () => {
    getSellerId.mockReturnValue(null); // No sellerId

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Seller session not found. Please login again.")).toBeInTheDocument();
    });

    // Verify no service calls were made with invalid sellerId
    expect(sellerService.getSellerNewOrders).not.toHaveBeenCalled();
  });

  test("4. Source code audit: DashboardPage source does not contain hardcoded test IDs (HS1380 or HS1018)", () => {
    const filePath = path.resolve(__dirname, "../DashboardPage.js");
    const sourceCode = fs.readFileSync(filePath, "utf8");

    expect(sourceCode).not.toContain("HS1380");
    expect(sourceCode).not.toContain("HS1018");
  });
});
