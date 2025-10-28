import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// --- Конфигурация ---
const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const VERIFY_URL = process.env.VERIFY_URL || "https://genge.vercel.app/verifyOwnership";

// --- GET /api/mint/1 --- для x402, минт 1 NFT ---
app.get("/api/mint/1", (req, res) => {
  res.status(402).json({
    x402Version: 1,
    payer: PAY_TO,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "3",
        resource: VERIFY_URL,
        description: "Verify payment to mint 1 NFT",
        mimeType: "application/json",
        payTo: PAY_TO,
        maxTimeoutSeconds: 10,
        asset: "USDC",
        bodyFields: {
          wallet: { type: "string", description: "Wallet address" },
          txHash: { type: "string", description: "Transaction hash" }
        },
        required: ["wallet", "txHash"],
        outputSchema: {
          success: { type: "boolean" },
          message: { type: "string" }
        },
        extra: { provider: "GENGE", category: "Minting" }
      }
    ]
  });
});

// --- GET /api/mint/3 --- для x402, минт 3 NFT ---
app.get("/api/mint/3", (req, res) => {
  res.status(402).json({
    x402Version: 1,
    payer: PAY_TO,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "9",
        resource: VERIFY_URL,
        description: "Verify payment to mint 3 NFTs",
        mimeType: "application/json",
        payTo: PAY_TO,
        maxTimeoutSeconds: 10,
        asset: "USDC",
        bodyFields: {
          wallet: { type: "string", description: "Wallet address" },
          txHash: { type: "string", description: "Transaction hash" }
        },
        required: ["wallet", "txHash"],
        outputSchema: {
          success: { type: "boolean" },
          message: { type: "string" }
        },
        extra: { provider: "GENGE", category: "Minting" }
      }
    ]
  });
});

// --- POST /api/mint/1 — минтинг 1 NFT ---
app.post("/api/mint/1", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;

    if (!wallet || !txHash) {
      return res.status(400).json({ error: "Wallet and txHash required" });
    }

    const verifyResp = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, txHash })
    });
    const verifyData = await verifyResp.json();

    if (!verifyData.success) {
      return res.status(400).json({ error: verifyData.error || "Transaction verification failed" });
    }

    return res.status(200).json({
      success: true,
      wallet,
      minted: 1,
      txHash,
      message: `✅ Successfully minted 1 NFT`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// --- POST /api/mint/3 — минтинг 3 NFT ---
app.post("/api/mint/3", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;

    if (!wallet || !txHash) {
      return res.status(400).json({ error: "Wallet and txHash required" });
    }

    const verifyResp = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, txHash })
    });
    const verifyData = await verifyResp.json();

    if (!verifyData.success) {
      return res.status(400).json({ error: verifyData.error || "Transaction verification failed" });
    }

    return res.status(200).json({
      success: true,
      wallet,
      minted: 3,
      txHash,
      message: `✅ Successfully minted 3 NFTs`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GENGE API running on port ${port}`));

export default app;
