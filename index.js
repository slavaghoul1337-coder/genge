import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// ✅ Читаем тело запроса вручную (устраняет баги Vercel)
app.use((req, res, next) => {
  let data = "";
  req.on("data", chunk => {
    data += chunk;
  });
  req.on("end", () => {
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch (err) {
      return res.status(400).send("Bad JSON");
    }
    next();
  });
});

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ message: "GENGE API is live", x402: true });
});

app.post("/verifyOwnership", async (req, res) => {
  const { wallet, tokenId, txHash } = req.body || {};

  if (!wallet || tokenId === undefined || !txHash) {
    return res.status(400).json({ error: "Missing wallet, tokenId or txHash" });
  }

  // 🔹 Временный тестовый ответ для x402scan
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
              txHash: { type: "string", required: true, description: "Transaction hash" }
            }
          },
          output: {
            success: true,
            wallet,
            tokenId,
            verified: true,
            message: "Ownership verified (test mode)"
          }
        }
      }
    ],
    payer: wallet
  };

  res.status(200).json(response);
});

app.listen(PORT, () => {
  console.log(`✅ GENGE API running on port ${PORT}`);
});
