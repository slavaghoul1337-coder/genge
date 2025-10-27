import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// ✅ Главная страница
app.get("/", (req, res) => {
  res.json({ message: "SPENGE API is live", x402: true });
});

// ✅ Тестовый эндпоинт verifyOwnership
app.post("/verifyOwnership", async (req, res) => {
  const { wallet, tokenId, txHash } = req.body;

  if (!wallet || tokenId === undefined || !txHash) {
    return res.status(400).json({ error: "Missing wallet, tokenId or txHash" });
  }

  // 🔹 Временная заглушка проверки платежа (x402CheckPayment отключен)
  const paymentOk = true;

  if (!paymentOk) {
    return res.status(402).json({ error: "Payment required or invalid" });
  }

  // ✅ Ответ в формате X402Response
  const response = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "2",
        resource: "SPENGE#verifyOwnership",
        description: "Verify ownership of SPENGE NFT",
        mimeType: "application/json",
        payTo: process.env.PAY_TO || "0xFDB14ec968C075335c3800733F8F9AAB8619E203",
        maxTimeoutSeconds: 10,
        asset: "USDC",
        outputSchema: {
          input: {
            type: "http",
            method: "POST",
            bodyType: "json",
            bodyFields: {
              wallet: { type: "string", required: true, description: "Wallet to check" },
              tokenId: { type: "number", required: true, description: "NFT tokenId" },
              txHash: { type: "string", required: true, description: "Transaction hash" }
            }
          },
          output: {
            success: true,
            wallet,
            tokenId
          }
        }
      }
    ],
    payer: wallet
  };

  res.status(200).json(response);
});

// ✅ Старт сервера (для локальных тестов)
app.listen(PORT, () => {
  console.log(`✅ SPENGE API running on port ${PORT}`);
});
