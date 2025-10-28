import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { wallet, txHash } = req.body;

    if (!wallet || !txHash) {
      return res.status(400).json({ error: "Missing wallet or txHash" });
    }

    const PAY_TO = process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9";
    const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

    if (!ETHERSCAN_API_KEY) {
      return res.status(500).json({ error: "Missing ETHERSCAN_API_KEY in .env" });
    }

    // --- Новый endpoint Etherscan V2 с поддержкой сети Base ---
    const url = `https://api.etherscan.io/v2/api?chain=base&module=transaction&action=gettxinfo&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data || data.status !== "1" || !data.result) {
      return res.status(400).json({ success: false, message: "Transaction not found or invalid" });
    }

    const tx = data.result;
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    const value = parseFloat(tx.value) / 1e6; // USDC (6 знаков после запятой)

    if (to !== PAY_TO.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Transaction sent to wrong address" });
    }

    if (value < 3) {
      return res.status(400).json({ success: false, message: "Insufficient USDC amount (<3)" });
    }

    if (tx.isError === "1") {
      return res.status(400).json({ success: false, message: "Transaction failed" });
    }

    return res.status(200).json({
      success: true,
      wallet,
      txHash,
      verified: true,
      message: "✅ Payment verified successfully"
    });

  } catch (err) {
    console.error("verifyOwnership error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
