import axios from "axios";
import {
  getSellerProductInventory,
  incrementInventory,
  decrementInventory,
  getProductStats
} from "../sellerService";
import { resolveSellerId } from "../../utils/sellerSession";

jest.mock("axios");
jest.mock("../../utils/sellerSession", () => ({
  resolveSellerId: jest.fn(),
  getSellerId: jest.fn()
}));

describe("sellerService - Seller ID & Parameter Logic Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveSellerId.mockReturnValue("HS1380");
  });

  test("1. getSellerProductInventory calls correct endpoint with correct parameters", async () => {
    axios.get.mockResolvedValue({ data: { inventoryItems: [], totalItems: 0 } });

    await getSellerProductInventory({ sellerId: "HS1380", page: 1, searchText: "test" });

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/sellerproductInventory"),
      expect.objectContaining({
        params: {
          sellerId: "HS1380",
          page: 1,
          searchText: "test"
        }
      })
    );
    // Explicitly assert it did not call sellertickets
    expect(axios.get).not.toHaveBeenCalledWith(
      expect.stringContaining("/sellertickets"),
      expect.any(Object)
    );
  });

  test("2. incrementInventory and decrementInventory call correct endpoints", async () => {
    axios.post.mockResolvedValue({ data: { success: true } });

    await incrementInventory("HS1380", "prod-1", "var-1", 5);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/incrementInventory"),
      { sellerId: "HS1380", productId: "prod-1", variantId: "var-1", quantity: 5 },
      expect.any(Object)
    );

    await decrementInventory("HS1380", "prod-1", "var-1", 2);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/decrementInventory"),
      { sellerId: "HS1380", productId: "prod-1", variantId: "var-1", quantity: 2 },
      expect.any(Object)
    );
  });

  test("3. getProductStats correctly routes sellerId or tableId parameters", async () => {
    axios.get.mockResolvedValue({ data: {} });

    // Branch A: starts with HS -> sellerId query parameter
    await getProductStats("HS1380");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/getProductStats"),
      expect.objectContaining({
        params: {
          sellerId: "HS1380"
        }
      })
    );

    // Branch B: does not start with HS -> tableId query parameter
    await getProductStats("table-xyz-999");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/getProductStats"),
      expect.objectContaining({
        params: {
          tableId: "table-xyz-999"
        }
      })
    );
  });
});
