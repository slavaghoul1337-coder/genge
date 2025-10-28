import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// --- Конфигурация ---
const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const VERIFY_URL = process.env.VERIFY_URL || "https://genge.vercel.app/verifyOwnership";

// --- GET /api/mint/:amount для x402 ---
app.get("/api/mint/:amount", (req, res) => {
  const amount = parseInt(req.params.amount);
  if (![1, 3].includes(amount)) {
    return res.status(400).json({ error: "Invalid mint amount. Must be 1 or 3" });
  }

  res.status(402).json({
    x402Version: 1,
    payer: PAY_TO,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: amount.toString(),
        resource: VERIFY_URL,
        description: `Verify payment to mint ${amount} NFT${amount > 1 ? "s" : ""}`,
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
        extra: { provider: "GENGE", category: "Minting" }
      }
    ]
  });
});

// --- POST /api/mint/:amount — минтинг ---
app.post("/api/mint/:amount", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;
    const amount = parseInt(req.params.amount);

    if (!wallet || !txHash) {
      return res.status(400).json({ error: "Wallet and txHash required" });
    }
    if (![1, 3].includes(amount)) {
      return res.status(400).json({ error: "Invalid mint amount. Must be 1 or 3" });
    }

    // Проверяем транзакцию через verifyOwnership
    const verifyResp = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, txHash })
    });

    const verifyData = await verifyResp.json();

    if (!verifyData.success) {
      return res.status(400).json({ error: verifyData.error || "Transaction verification failed" });
    }

    // Минт 1 или 3 NFT (имитация, вставь реальный код минта)
    return res.status(200).json({
      success: true,
      wallet,
      minted: amount,
      txHash,
      message: `✅ Successfully minted ${amount} NFT${amount > 1 ? "s" : ""}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GENGE API running on port ${port}`));

export default app;
