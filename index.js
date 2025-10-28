import express from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

// --- Конфигурация из .env ---
const RPC_URL = process.env.RPC_URL;
const PAY_TO = process.env.PAY_TO;
const X402_API = process.env.X402_API;
const X402_API_KEY = process.env.X402_API_KEY;
const REQUIRED_AMOUNT = ethers.parseUnits("2", 6); // USDC 6 decimals
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC токен на Base

// --- RPC Provider ---
const provider = new ethers.JsonRpcProvider(RPC_URL);

// --- GET /verifyOwnership для X402Scan ---
app.get("/verifyOwnership", (req, res) => {
  res.status(402).json({
    x402Version: 1,
    payer: "0x0000000000000000000000000000000000000000",
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "2",
        resource: "https://genge.vercel.app/verifyOwnership",
        description: "Verify 2 USDC payment",
        mimeType: "application/json",
        payTo: PAY_TO,
        maxTimeoutSeconds: 10,
        asset: "USDC",
        outputSchema: {
          input: { type: "http", method: "POST", bodyType: "json", bodyFields: { wallet: { type: "string" }, txHash: { type: "string" } } },
          output: { success: { type: "boolean" }, message: { type: "string" } }
        },
        extra: { provider: "GENGE", category: "Verification" }
      }
    ]
  });
});

// --- POST /verifyOwnership проверка перевода ERC-20 ---
app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;
    if (!wallet || !txHash) return res.status(400).json({ error: "Missing wallet or txHash" });

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(400).json({ error: "Transaction not found" });

    const transferEvent = receipt.logs.find(
      log => log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()
    );

    if (!transferEvent) return res.status(400).json({ error: "No USDC transfer found" });

    // decode log
    const iface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ]);
    const parsed = iface.parseLog(transferEvent);

    const from = parsed.args.from.toLowerCase();
    const to = parsed.args.to.toLowerCase();
    const value = parsed.args.value;

    if (from !== wallet.toLowerCase()) return res.status(400).json({ error: "Transaction sent from wrong wallet" });
    if (to !== PAY_TO.toLowerCase()) return res.status(400).json({ error: "Transaction sent to wrong address" });
    if (value.lt(REQUIRED_AMOUNT)) return res.status(400).json({ error: "Insufficient amount" });

    return res.status(200).json({
      success: true,
      wallet,
      txHash,
      verified: true,
      message: "✅ Payment verified successfully"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GENGE API running on port ${port}`));
export default app;
