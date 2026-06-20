import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdvertisementPage from "../AdvertisementPage";
import { resolveSellerId } from "../../../utils/sellerSession";
import { advertisementService } from "../../../services/sellerService";

jest.mock("../../../utils/sellerSession", () => ({
  resolveSellerId: jest.fn()
}));

jest.mock("../../../services/sellerService", () => ({
  advertisementService: {
    getCampaigns: jest.fn(),
    pauseCampaign: jest.fn(),
    resumeCampaign: jest.fn(),
    deleteCampaign: jest.fn()
  }
}));

describe("AdvertisementPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveSellerId.mockReturnValue("HS1380");
  });

  test("renders campaign table with fetched data", async () => {
    advertisementService.getCampaigns.mockResolvedValue({
      status: "success",
      message: {
        campaigns: [
          {
            campaignId: "CAMP1001",
            campaignName: "Smart Promo 1",
            campaignType: "Smart",
            status: "Active",
            startDate: "2026-06-20",
            startTime: "09:00 AM",
            dailyBudget: 250
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <AdvertisementPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Smart Promo 1")).toBeInTheDocument();
    });

    expect(screen.getByText("CAMP1001")).toBeInTheDocument();
    expect(screen.getByText("₹250")).toBeInTheDocument();
  });

  test("filters campaigns by name or id locally", async () => {
    advertisementService.getCampaigns.mockResolvedValue([
      { campaignId: "CAMP1001", campaignName: "Smart A", campaignType: "Smart", status: "Active", dailyBudget: 250 },
      { campaignId: "CAMP1002", campaignName: "Test B", campaignType: "Smart", status: "Paused", dailyBudget: 550 }
    ]);

    render(
      <MemoryRouter>
        <AdvertisementPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Smart A")).toBeInTheDocument();
    });

    expect(screen.getByText("Test B")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search Campaign");
    fireEvent.change(searchInput, { target: { value: "smart" } });

    expect(screen.getByText("Smart A")).toBeInTheDocument();
    expect(screen.queryByText("Test B")).not.toBeInTheDocument();
  });
});
