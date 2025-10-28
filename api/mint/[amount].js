import fetch from "node-fetch";

const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
const VERIFY_URL = process.env.VERIFY_URL || "https://genge.vercel.app/verifyOwnership";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { wallet, txHash } = req.body;
    const { amount } = req.query; // динамический параметр из URL: 1 или 3

    if (!wallet || !txHash) {
      return res.status(400).json({ error: "Wallet and txHash required" });
    }

    const mintAmount = parseInt(amount);
    if (![1, 3].includes(mintAmount)) {
      return res.status(400).json({ error: "Invalid amount, only 1 or 3 allowed" });
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

    // Минт NFT (имитация, вставь свой фактический код)
    return res.status(200).json({
      success: true,
      wallet,
      minted: mintAmount,
      txHash,
      message: `✅ Successfully minted ${mintAmount} NFT(s)`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
}
