import React from "react";
import { render, waitFor } from "@testing-library/react";
import InventoryPage from "../InventoryPage";
import { getSellerId } from "../../../utils/sellerSession";
import sellerService from "../../../services/sellerService";

jest.mock("../../../utils/sellerSession", () => ({
  getSellerId: jest.fn()
}));

jest.mock("../../../services/sellerService", () => {
  return {
    __esModule: true,
    default: {
      getSellerProductInventory: jest.fn().mockResolvedValue({ inventoryItems: [], totalItems: 0 }),
      incrementInventory: jest.fn(),
      decrementInventory: jest.fn()
    },
    resolveWixImage: jest.fn((img) => img)
  };
});

describe("InventoryPage - API Structure Tests", () => {
  const mockSellerId = "HS1380";

  beforeEach(() => {
    jest.clearAllMocks();
    getSellerId.mockReturnValue(mockSellerId);
  });

  test("1. Inventory page calls getSellerProductInventory with correct parameters", async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      expect(sellerService.getSellerProductInventory).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: mockSellerId,
          page: 1,
          searchText: ""
        })
      );
    });
  });
});
