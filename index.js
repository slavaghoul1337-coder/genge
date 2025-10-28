import express from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

// --- Конфигурация из .env ---
const RPC_URL = process.env.RPC_URL || "https://rpc.ankr.com/base/your-api-key";
const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const PORT = process.env.PORT || 3000;

// --- ERC-20 ABI для Transfer ---
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const REQUIRED_AMOUNT = ethers.parseUnits("2", 6); // 2 USDC

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

// --- Описание ресурса для X402 ---
const RESOURCE_DESCRIPTION = {
  x402Version: 1,
  payer: "0x0000000000000000000000000000000000000000",
  accepts: [
    {
      scheme: "exact",
      network: "base",
      maxAmountRequired: "2",
      resource: "https://genge.vercel.app/verifyOwnership",
      description: "Verify payment of 2 USDC to PAY_TO wallet",
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
            wallet: { type: "string", required: ["wallet"], description: "Wallet address that sent payment" },
            txHash: { type: "string", required: ["txHash"], description: "Transaction hash of the payment" }
          }
        },
        output: {
          success: { type: "boolean" },
          message: { type: "string" }
        }
      },
      extra: { provider: "GENGE", category: "Payment Verification" }
    }
  ]
};

// --- GET для X402 ---
app.get("/verifyOwnership", (req, res) => {
  res.status(402).json(RESOURCE_DESCRIPTION);
});

// --- POST проверка оплаты ---
app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;
    if (!wallet || !txHash)
      return res.status(400).json({ error: "Missing wallet or txHash" });

    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt) return res.status(400).json({ error: "Transaction not found" });

    // Ищем Transfer к PAY_TO
    const transferEvents = txReceipt.logs
      .map(log => {
        try { return usdcContract.interface.parseLog(log); } catch { return null; }
      })
      .filter(log => log && log.name === "Transfer");

    const matched = transferEvents.find(e =>
      e.args.from.toLowerCase() === wallet.toLowerCase() &&
      e.args.to.toLowerCase() === PAY_TO.toLowerCase() &&
      e.args.value.gte(REQUIRED_AMOUNT)
    );

    if (!matched) return res.status(400).json({ error: "Transaction does not match required payment" });

    return res.status(200).json({
      success: true,
      wallet,
      txHash,
      verified: true,
      message: `✅ Payment of 2 USDC verified successfully from ${wallet} to ${PAY_TO}`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.listen(PORT, () => console.log(`GENGE API running on port ${PORT}`));
export default app;
