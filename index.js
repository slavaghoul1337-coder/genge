import express from "express";
import { ethers } from "ethers";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// --- Конфигурация из .env ---
const RPC_URL = process.env.RPC_URL || "https://rpc.ankr.com/base/YOUR_KEY";
const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC контракт
const MIN_USDC_AMOUNT = ethers.parseUnits("2", 6); // 2 USDC

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
      description: "Verify USDC payment transaction for GENGE mint",
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

// --- GET /verifyOwnership для X402 ---
app.get("/verifyOwnership", (req, res) => {
  res.status(402).json(RESOURCE_DESCRIPTION);
});

// --- POST /verifyOwnership проверка USDC ---
app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;
    if (!wallet || !txHash) return res.status(400).json({ error: "Invalid request format" });

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Получаем транзакцию
    const tx = await provider.getTransaction(txHash);
    if (!tx) return res.status(400).json({ error: "Transaction not found" });

    // Токен ERC-20 (USDC) — мы проверяем только переводы на PAY_TO
    if (tx.to.toLowerCase() !== USDC_CONTRACT.toLowerCase()) {
      return res.status(400).json({ error: "Transaction not sent to USDC contract" });
    }

    // Получаем receipt и ищем Transfer событие
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || !receipt.logs) return res.status(400).json({ error: "No logs in transaction" });

    const iface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ]);

    let valid = false;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (
          parsed.name === "Transfer" &&
          parsed.args.from.toLowerCase() === wallet.toLowerCase() &&
          parsed.args.to.toLowerCase() === PAY_TO.toLowerCase() &&
          parsed.args.value.gte(MIN_USDC_AMOUNT)
        ) {
          valid = true;
          break;
        }
      } catch {}
    }

    if (!valid) return res.status(400).json({ error: "Transaction sent to wrong address or insufficient USDC" });

    // Всё ок
    return res.status(200).json({
      success: true,
      wallet,
      txHash,
      verified: true,
      message: `✅ Payment of ≥2 USDC verified successfully`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GENGE API running on port ${port}`));
export default app;
