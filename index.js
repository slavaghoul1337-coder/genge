import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Провайдер и контракт
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const abi = [
  "function balanceOf(address owner, uint256 tokenId) view returns (uint256)"
];
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);

// Хранилище использованных txHash
const usedTxs = new Set();

// Проверка платежа через x402 фасилитатора
async function x402CheckPayment(txHash, wallet, tokenId) {
  const resp = await fetch(`${process.env.X402_API}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.X402_API_KEY}`
    },
    body: JSON.stringify({ txHash, wallet, tokenId })
  });

  const data = await resp.json();
  return data.success === true;
}

// Endpoint проверки владения NFT и оплаты
app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, tokenId, txHash } = req.body;
    if (!wallet || tokenId === undefined || !txHash) {
      return res.status(400).json({ error: "Missing wallet, tokenId or txHash" });
    }

    // 1. Проверка, что txHash ещё не использован
    if (usedTxs.has(txHash)) {
      return res.status(400).json({ error: "Transaction already used" });
    }

    // 2. Проверка через x402 фасилитатор
    const paymentOk = await x402CheckPayment(txHash, wallet, tokenId);
    if (!paymentOk) {
      return res.status(402).json({ error: "Payment required or invalid" });
    }

    // 3. Проверка владения NFT через контракт
    const balance = await contract.balanceOf(wallet, tokenId);
    if (balance === 0) {
      return res.status(402).json({ error: "NFT not owned" });
    }

    // 4. Логируем транзакцию
    usedTxs.add(txHash);

    // 5. Формируем X402Response
    const response = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: "0.002",
          resource: `GENGE#verifyOwnership`,
          description: "Verify ownership of GENGE NFT",
          mimeType: "application/json",
          payTo: process.env.PAY_TO,
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

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`GENGE API running on port ${process.env.PORT}`);
});
