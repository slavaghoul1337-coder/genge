// index.js
import express from "express";
import { ethers } from "ethers";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

// --- Настройки из окружения ---
const RPC_URL = process.env.RPC_URL || "https://rpc.ankr.com/base/REPLACE_WITH_YOUR_KEY";
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || "0x49de8a5d488d33afbba93d6f5f1bc08924ef1718").toLowerCase();
const PAY_TO = (process.env.PAY_TO || "0x390d45A9375b9C81c3044314EDE0c9C8E5229DD9").toLowerCase();
const X402_API = process.env.X402_API || "";
const X402_API_KEY = process.env.X402_API_KEY || "";
const MIN_AMOUNT_REQUIRED = process.env.MIN_AMOUNT_REQUIRED || "2"; // informational
const PORT = process.env.PORT || 3000;

// --- Провайдер и интерфейсы ---
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ERC721 (ownerOf)
const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)"
];

// ERC20 Transfer event decoding
const ERC20_LOG_IFACE = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

// хранилище использованных txHash (in-memory). Можно заменить на БД в будущем.
const usedTxs = new Set();

// Доп. лог-файл (в проде это ephemeral, но пригодно для отладки)
const LOG_FILE = path.join("/tmp", "used_tx_hashes.log");

// helper: логировать использованные txHash в файл
function appendUsedTx(txHash, wallet, tokenId) {
  try {
    const line = `${new Date().toISOString()} txHash=${txHash} wallet=${wallet} tokenId=${tokenId}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    console.error("Failed to append tx log:", e);
  }
}

// helper: запрос к x402 фасилитатору (если задан)
async function x402CheckPayment(txHash, wallet, tokenId) {
  if (!X402_API || !X402_API_KEY) return false;
  try {
    const resp = await fetch(X402_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${X402_API_KEY}`
      },
      body: JSON.stringify({ txHash, wallet, tokenId })
    });
    if (!resp.ok) {
      console.warn("x402 responded not ok:", resp.status);
      return false;
    }
    const data = await resp.json();
    return data && data.success === true;
  } catch (err) {
    console.error("x402CheckPayment error:", err);
    return false;
  }
}

// helper: on-chain check — смотрим receipt, статус и логи Transfer -> PAY_TO
async function onChainCheckPayment(txHash, wallet, tokenId) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { ok: false, reason: "Transaction not found or not yet mined" };
    }
    if (receipt.status !== 1 && receipt.status !== 0) {
      // ethers v6 can return 1 for success; if undefined treat as error
      // normalize: success if status === 1
    }
    // статус 1 — успешная транзакция
    if (receipt.status !== 1) {
      return { ok: false, reason: "Transaction failed" };
    }

    // Пробегаем по логам и ищем Transfer(..., to=PAY_TO)
    for (const log of receipt.logs || []) {
      try {
        // Попытка распарсить через ERC20 Transfer ABI
        const parsed = ERC20_LOG_IFACE.parseLog(log);
        if (parsed && parsed.name === "Transfer") {
          const to = parsed.args.to?.toLowerCase();
          const from = parsed.args.from?.toLowerCase();
          const value = parsed.args.value?.toString?.() || "0";
          if (to === PAY_TO) {
            return { ok: true, detail: { from, to, value } };
          }
        }
      } catch (e) {
        // ignore non-ERC20 logs
      }
    }

    // если не нашли Transfer-to-PAY_TO — возможно это native transfer (eth) or internal tx
    // проверим саму транзакцию (на случай native transfer)
    const tx = await provider.getTransaction(txHash);
    if (tx && tx.to && tx.to.toLowerCase() === PAY_TO) {
      return { ok: true, detail: { nativeSend: true, value: tx.value?.toString?.() || "0" } };
    }

    return { ok: false, reason: "No transfer to PAY_TO found in tx logs or tx.to" };
  } catch (err) {
    console.error("onChainCheckPayment error:", err);
    return { ok: false, reason: "onChain error", err: err.message || String(err) };
  }
}

// Сформировать корректный X402 ресурс для GET (возвращаем 402)
function makeResourceDescription(baseUrl) {
  return {
    x402Version: 1,
    payer: "0x0000000000000000000000000000000000000000",
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: MIN_AMOUNT_REQUIRED,
        resource: `${baseUrl}/verifyOwnership`,
        description: "Verify ownership of GENGE NFT or payment transaction",
        mimeType: "application/json",
        payTo: PAY_TO,
        maxTimeoutSeconds: 10,
        asset: "USDC",
        outputSchema: {
          input: {
            type: "http",
            method: "POST",
            bodyType: "json",
            bodyFields: {
              wallet: { type: "string", required: ["wallet"], description: "Wallet to check (owner or payer)" },
              tokenId: { type: "number", required: ["tokenId"], description: "NFT tokenId to verify ownership" },
              txHash: { type: "string", required: ["txHash"], description: "Transaction hash of payment" }
            }
          },
          output: {
            success: { type: "boolean" },
            wallet: { type: "string" },
            tokenId: { type: "number" },
            verified: { type: "boolean" },
            message: { type: "string" }
          }
        },
        extra: { provider: "GENGE", category: "Verification" }
      }
    ]
  };
}

// GET — возвращаем X402Response (status 402)
app.get("/verifyOwnership", (req, res) => {
  const baseUrl = process.env.BASE_URL || `https://${process.env.VERCEL_URL || "genge.vercel.app"}`;
  const desc = makeResourceDescription(baseUrl.replace(/^https?:\/\//, "https://"));
  // Возвращаем 402 именно для x402scan согласно их требованиям
  res.status(402).json(desc);
});

// POST — реальная проверка
app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, tokenId, txHash } = req.body ?? {};
    if (!wallet || tokenId === undefined || !txHash) {
      return res.status(400).json({ error: "Missing wallet, tokenId or txHash" });
    }

    // 1) Проверяем повторное использование txHash
    if (usedTxs.has(txHash)) {
      return res.status(400).json({ error: "Transaction already used" });
    }

    const normalizedWallet = wallet.toLowerCase();

    // 2) Сначала пробуем фасилитатора x402 (если доступен)
    let paymentOk = false;
    if (X402_API && X402_API_KEY) {
      try {
        paymentOk = await x402CheckPayment(txHash, wallet, tokenId);
      } catch (e) {
        console.warn("x402 check failed:", e);
        paymentOk = false;
      }
    }

    // 3) Фоллбэк: on-chain проверка, если x402 не подтвердил
    let onChainResult = null;
    if (!paymentOk) {
      onChainResult = await onChainCheckPayment(txHash, wallet, tokenId);
      paymentOk = Boolean(onChainResult?.ok);
    }

    // 4) Проверка владения NFT через ownerOf
    let ownsNFT = false;
    try {
      const nftContract = new ethers.Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);
      const owner = await nftContract.ownerOf(tokenId);
      if (owner && owner.toLowerCase() === normalizedWallet) ownsNFT = true;
    } catch (e) {
      // если ownerOf выбросил (token не существует) — считаем как не владение
      console.warn("ownerOf check error:", e?.message || e);
      ownsNFT = false;
    }

    const verified = paymentOk || ownsNFT;

    if (!verified) {
      // Если не прошли ни платёж, ни владение — возвращаем 402/400 (в зависимости)
      // Отправим 402 Payment Required, чтобы x402scan понял, что нужно оплатить
      return res.status(402).json({ error: "Payment required or invalid", details: { paymentOk, onChainResult, ownsNFT } });
    }

    // 5) Логируем txHash как использованный
    usedTxs.add(txHash);
    appendUsedTx(txHash, wallet, tokenId);

    // 6) Ответ в формате X402 output
    const out = {
      success: true,
      wallet,
      tokenId,
      verified: true,
      message: ownsNFT ? "Ownership verified via ownerOf" : (paymentOk ? "Payment verified" : "Verified")
    };

    return res.status(200).json(out);

  } catch (err) {
    console.error("verifyOwnership error:", err);
    return res.status(500).json({ error: "Server error", details: err?.message || String(err) });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`GENGE API running on port ${PORT} (RPC ${RPC_URL ? "configured" : "missing"})`);
});

export default app;
