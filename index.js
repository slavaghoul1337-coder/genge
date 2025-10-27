import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// ✅ универсальный парсер для Vercel
app.use(async (req, res, next) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    if (!raw) {
      req.body = {};
      return next();
    }
    try {
      if (req.headers["content-type"]?.includes("application/json")) {
        // убираем невидимые BOM символы
        raw = raw.trim().replace(/^\uFEFF/, "");
        req.body = JSON.parse(raw);
      } else {
        req.body = {};
      }
      next();
    } catch (e) {
      console.error("JSON parse error:", e.message);
      res.status(400).send("Bad JSON Format");
    }
  });
});

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ message: "GENGE API is live", x402: true });
});

app.post("/verifyOwnership", (req, res) => {
  const { wallet, tokenId, txHash } = req.body || {};

  if (!wallet || tokenId === undefined || !txHash) {
    return res.status(400).json({
      error: "Missing wallet, tokenId or txHash",
      received: req.body,
    });
  }

  // ✅ тестовый X402Response
  const response = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "2",
        resource: "GENGE#verifyOwnership",
        description: "Verify ownership of GENGE NFT or payment transaction",
        mimeType: "application/json",
        payTo: "0xFDB14ec968C075335c3800733F8F9AAB8619E203",
        maxTimeoutSeconds: 10,
        asset: "USDC",
        outputSchema: {
          input: {
            type: "http",
            method: "POST",
            bodyType: "json",
            bodyFields: {
              wallet: { type: "string", required: true, description: "Wallet address" },
              tokenId: { type: "number", required: true, description: "NFT tokenId" },
              txHash: { type: "string", required: true, description: "Transaction hash" },
            },
          },
          output: {
            success: true,
            wallet,
            tokenId,
            verified: true,
            message: "Ownership verified (test mode)",
          },
        },
      },
    ],
    payer: wallet,
  };

  res.status(200).json(response);
});

app.listen(PORT, () => {
  console.log(`✅ GENGE API running on port ${PORT}`);
});
