import express from "express";
import { ethers } from "ethers";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// --- Конфигурация из .env ---
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x49de8a5d488d33afbba93d6f5f1bc08924ef1718";
const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const X402_API = process.env.X402_API;
const X402_API_KEY = process.env.X402_API_KEY;

// --- ABI для проверки NFT ---
const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
];

// --- Основное описание ресурса ---
const RESOURCE_DESCRIPTION = {
  x402Version: 1,
  payer: "0x0000000000000000000000000000000000000000",
  accepts: [
    {
      scheme: "exact",
      network: "base",
      maxAmountRequired: "2",
      resource: "https://genge.vercel.app/verifyOwnership",
      description: "Verify ownership of GENGE NFT or payment transaction",
      mimeType: "application/json",
      payTo: PAY_TO,
      maxTimeoutSeconds: 10,
      asset: "USDC",
      outputSchema: {
        input: {
          type: "http",
          method: "POST",
          bodyType: "json",
          bodyFields: {
            wallet: { type: "string", required: ["wallet"], description: "Wallet address" },
            tokenId: { type: "number", required: ["tokenId"], description: "NFT tokenId" },
            txHash: { type: "string", required: ["txHash"], description: "Transaction hash" }
          }
        },
        output: {
          success: { type: "boolean" },
          message: { type: "string" }
        }
      },
      extra: { provider: "GENGE", category: "Verification" }
    }
  ]
};

// === GET /verifyOwnership — для X402Scan ===
app.get("/verifyOwnership", (req, res) => {
  res.status(402).json(RESOURCE_DESCRIPTION);
});

// === POST /verifyOwnership — проверка владения NFT ===
app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, tokenId, txHash } = req.body;
    if (!wallet || tokenId === undefined || !txHash)
      return res.status(400).json({ error: "Invalid request format" });

    // Подключаемся к RPC
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);

    // Проверяем владельца токена
    const owner = await contract.ownerOf(tokenId);
    const normalizedOwner = owner.toLowerCase();
    const normalizedWallet = wallet.toLowerCase();

    if (normalizedOwner !== normalizedWallet) {
      return res.status(400).json({ error: "Wallet does not own this token" });
    }

    // Если всё успешно
    return res.status(200).json({
      success: true,
      wallet,
      tokenId,
      verified: true,
      message: "✅ Ownership verified successfully for Manifold GENGE NFT"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GENGE API running on port ${port}`));
export default app;
