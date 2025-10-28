import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const { wallet, txHash } = req.body;
    if (!wallet || !txHash) {
      return res.status(400).json({ success: false, error: "Missing wallet or txHash" });
    }

    // Проверяем транзакцию через Basescan API (аналог Etherscan))
    const apiKey = process.env.BASESCAN_API_KEY;
    const apiUrl = `https://api.basescan.org/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${apiKey}`;

    const resp = await fetch(apiUrl);
    const data = await resp.json();

    // Ответ может быть вида { status: "1", message: "OK", result: { status: "1" } }
    if (data.status === "1" && data.result?.status === "1") {
      return res.status(200).json({
        success: true,
        verified: true,
        wallet,
        txHash,
        message: "✅ Transaction verified on BaseScan"
      });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "❌ Transaction not found or failed"
      });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", details: err.message });
  }
}
