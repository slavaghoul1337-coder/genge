import fetch from "node-fetch";

const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const VERIFY_URL = process.env.VERIFY_URL || "https://genge.vercel.app/api/verifyOwnership";

export default async function handler(req, res) {
  // --- Если x402 делает запрос для регистрации ресурса ---
  if (req.method === "GET") {
    return res.status(402).json({
      x402Version: 1,
      payer: PAY_TO,
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: "3.00",
          description: "Mint GENGE NFT for $3.00",
          mimeType: "application/json",
          payTo: PAY_TO,
          asset: "USDC",
          maxTimeoutSeconds: 10,
          outputSchema: {
            input: {
              type: "http",
              method: "POST",
              bodyType: "none"
            },
            output: {
              success: { type: "boolean" },
              message: { type: "string" }
            }
          },
          extra: {
            provider: "GENGE",
            category: "Minting"
          }
        }
      ]
    });
  }

  // --- Минтинг при POST-запросе ---
  if (req.method === "POST") {
    try {
      // Здесь можно добавить реальную проверку транзы через verifyOwnership
      // Сейчас просто имитация успешного минта:
      return res.status(200).json({
        success: true,
        minted: 1,
        message: "✅ Successfully minted 1 GENGE NFT"
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: "Server error", details: err.message });
    }
  }

  // --- Метод не поддерживается ---
  return res.status(405).json({ success: false, error: "Method not allowed" });
}
