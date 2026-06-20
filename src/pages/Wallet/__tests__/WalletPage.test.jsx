import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WalletPage from "../WalletPage";
import { resolveSellerId, walletService, getUserProfile } from "../../../services/sellerService";

jest.mock("../../../services/sellerService", () => {
  const original = jest.requireActual("../../../services/sellerService");
  return {
    ...original,
    resolveSellerId: jest.fn(),
    getUserProfile: jest.fn(),
    walletService: {
      checkWalletBalance: jest.fn(),
      transactionHistory: jest.fn(),
      createRazorpayOrder: jest.fn(),
      verifyRazorpayPayment: jest.fn(),
      addFunds: jest.fn()
    },
    getSellerCampaigns: jest.fn().mockResolvedValue([]),
    getCampaignDetails: jest.fn().mockResolvedValue({}),
    getCampaignSummary: jest.fn().mockResolvedValue({})
  };
});

describe("WalletPage - Seller ID Integration Tests", () => {
  const mockSellerId = "HS1380";
  const mockEmail = "seller@haatza.com";

  beforeEach(() => {
    jest.clearAllMocks();
    resolveSellerId.mockReturnValue(mockSellerId);
    
    // Mock storage email
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === "userEmail") return mockEmail;
      return null;
    });

    getUserProfile.mockResolvedValue({ status: "success", message: { sellerName: "Test Seller" } });
    walletService.checkWalletBalance.mockResolvedValue({ message: { RemainingBalance: 500 } });
    walletService.transactionHistory.mockResolvedValue({ message: { transactions: [] } });
  });

  test("1. WalletPage queries balance and transaction history with active sellerId", async () => {
    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>
    );

    // Verify wallet balance is fetched using mockSellerId
    await waitFor(() => {
      expect(walletService.checkWalletBalance).toHaveBeenCalledWith(mockSellerId);
    });

    // Click on Transaction History tab to trigger history load
    const tabButton = await screen.findByText("Transaction History");
    fireEvent.click(tabButton);

    // Verify transaction history is fetched using mockSellerId
    await waitFor(() => {
      expect(walletService.transactionHistory).toHaveBeenCalledWith(mockSellerId);
    });
  });
});
