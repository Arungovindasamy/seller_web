import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CreateCampaignPage from "../CreateCampaignPage";
import { resolveSellerId } from "../../../utils/sellerSession";
import { advertisementService, checkWalletBalance } from "../../../services/sellerService";

jest.mock("../../../utils/sellerSession", () => ({
  resolveSellerId: jest.fn()
}));

jest.mock("../../../services/sellerService", () => ({
  advertisementService: {
    fetchSellerCampaignProduct: jest.fn(),
    createCampaign: jest.fn()
  },
  checkWalletBalance: jest.fn(),
  resolveWixImage: (img) => img
}));

describe("CreateCampaignPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveSellerId.mockReturnValue("HS1380");
    checkWalletBalance.mockResolvedValue({
      status: "success",
      message: { RemainingBalance: 150.5 }
    });
  });

  test("Step 1 and Step 2 flow works", async () => {
    advertisementService.fetchSellerCampaignProduct.mockResolvedValue({
      status: "success",
      products: [
        {
          productId: "p1",
          name: "Test T-Shirt",
          price: 500,
          status: "In Stock"
        }
      ]
    });

    advertisementService.createCampaign.mockResolvedValue({ status: "success" });

    render(
      <MemoryRouter>
        <CreateCampaignPage />
      </MemoryRouter>
    );

    // Verify wallet balance is rendered
    await waitFor(() => {
      expect(screen.getByText("₹150.50")).toBeInTheDocument();
    });

    // We should see Step 1 components: campaign name input
    const nameInput = screen.getByPlaceholderText("Enter campaign name");
    expect(nameInput.value).toContain("New Smart Campaign");

    // Click continue to proceed to Step 2
    const continueBtn = screen.getByText("Continue");
    fireEvent.click(continueBtn);

    // Verify step transition to Choose the Products
    await waitFor(() => {
      expect(screen.getByText("Choose the Products")).toBeInTheDocument();
    });

    // Verify products table list
    await waitFor(() => {
      expect(screen.getByText("Test T-Shirt")).toBeInTheDocument();
    });

    // Check product checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    // checkboxes[0] is select all, checkboxes[1] is Test T-Shirt
    fireEvent.click(checkboxes[1]);

    // Submit campaign
    const submitBtn = screen.getByText("Submit");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(advertisementService.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: "HS1380",
          campaignType: "Smart",
          selectedProducts: ["p1"],
          dailyBudget: 250 // default preset option
        })
      );
    });
  });
});
