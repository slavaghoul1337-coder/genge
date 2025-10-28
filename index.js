import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// --- Конфигурация ---
const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const MIN_AMOUNT_USDC = 2; // Минимальная оплата
const MAX_BATCH = 10;

// --- Фейковый mint (подставь реальную логику минта NFT) ---
function mintNFT(wallet, quantity) {
  // Тут можно вызвать контракт или другой сервис
  return {
    wallet,
    quantity,
    minted: true,
    message: `✅ Successfully minted ${quantity} NFT(s) for ${wallet}`,
  };
}

// --- Проверка оплаты через txHash ---
async function verifyPayment(wallet, txHash) {
  try {
    const res = await fetch(`https://x402.dev/api/checkPayment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.X402_API_KEY,
      },
      body: JSON.stringify({ wallet, txHash }),
    });
    const data = await res.json();

    if (!data.success) {
      return { success: false, error: data.message || "Payment verification failed" };
    }

    // Проверяем что платеж пришел на нужный адрес и сумма >= MIN_AMOUNT_USDC
    if (
      data.to.toLowerCase() !== PAY_TO.toLowerCase() ||
      parseFloat(data.amount) < MIN_AMOUNT_USDC
    ) {
      return { success: false, error: "Transaction sent to wrong address or insufficient USDC" };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// === POST /verifyOwnership ===
app.post("/verifyOwnership", async (req, res) => {
  const { wallet, txHash } = req.body;
  if (!wallet || !txHash) return res.status(400).json({ error: "wallet and txHash required" });

  const verified = await verifyPayment(wallet, txHash);
  if (!verified.success) return res.status(400).json({ error: verified.error });

  return res.json({
    success: true,
    wallet,
    txHash,
    verified: true,
    message: "✅ Payment verified successfully",
  });
});

// === Mint endpoints ===
app.post("/api/mint", async (req, res) => {
  const { wallet, txHash } = req.body;
  if (!wallet || !txHash) return res.status(400).json({ error: "wallet and txHash required" });

  const verified = await verifyPayment(wallet, txHash);
  if (!verified.success) return res.status(400).json({ error: verified.error });

  return res.json(mintNFT(wallet, 1));
});

app.post("/api/mint/3", async (req, res) => {
  const { wallet, txHash } = req.body;
  if (!wallet || !txHash) return res.status(400).json({ error: "wallet and txHash required" });

  const verified = await verifyPayment(wallet, txHash);
  if (!verified.success) return res.status(400).json({ error: verified.error });

  return res.json(mintNFT(wallet, 3));
});

app.post("/api/mint/max", async (req, res) => {
  const { wallet, txHash } = req.body;
  if (!wallet || !txHash) return res.status(400).json({ error: "wallet and txHash required" });

  const verified = await verifyPayment(wallet, txHash);
  if (!verified.success) return res.status(400).json({ error: verified.error });

  return res.json(mintNFT(wallet, MAX_BATCH));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GENGE API running on port ${port}`));
export default app;
