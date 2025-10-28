import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// --- Конфигурация ---
const RPC_URL = process.env.RPC_URL;
const PAY_TO = process.env.PAY_TO; // твой кошелек, куда переводят $2
const PORT = process.env.PORT || 3000;

// --- Основное описание ресурса для X402 ---
const RESOURCE_DESCRIPTION = {
  x402Version: 1,
  payer: "0x0000000000000000000000000000000000000000",
  accepts: [
    {
      scheme: "exact",
      network: "base",
      maxAmountRequired: "2",
      resource: "https://genge.vercel.app/verifyOwnership",
      description: "Verify payment of $2 USDC to mint GENGE",
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

// === GET → X402Scan ===
app.get("/verifyOwnership", (req, res) => {
  res.status(402).json(RESOURCE_DESCRIPTION);
});

// === POST → Проверка транзакции $2 ===
app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;
    if (!wallet || !txHash) return res.status(400).json({ error: "Missing wallet or txHash" });

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tx = await provider.getTransaction(txHash);

    if (!tx) return res.status(400).json({ error: "Transaction not found" });

    const from = tx.from.toLowerCase();
    const to = tx.to?.toLowerCase();
    const value = ethers.formatUnits(tx.value, 6); // USDC на Base имеет 6 decimals

    if (from !== wallet.toLowerCase())
      return res.status(400).json({ error: "Transaction sent from different wallet" });
    if (to !== PAY_TO.toLowerCase())
      return res.status(400).json({ error: "Transaction sent to wrong address" });
    if (parseFloat(value) < 2)
      return res.status(400).json({ error: "Insufficient payment" });

    // Всё ок, возвращаем успех
    return res.status(200).json({
      success: true,
      wallet,
      txHash,
      verified: true,
      message: "✅ Payment verified successfully"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.listen(PORT, () => console.log(`GENGE Payment API running on port ${PORT}`));
export default app;
