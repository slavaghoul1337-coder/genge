import express from "express";

const app = express();
app.use(express.json());

const RESOURCE_DESCRIPTION = {
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
            wallet: {
              type: "string",
              required: true,
              description: "Wallet address",
            },
            tokenId: {
              type: "number",
              required: true,
              description: "NFT tokenId",
            },
            txHash: {
              type: "string",
              required: true,
              description: "Transaction hash",
            },
          },
        },
        output: {
          success: true,
          message: "Ownership verified",
        },
      },
    },
  ],
};

// ✅ Новый маршрут для x402scan
app.get("/verifyOwnership", (req, res) => {
  res.status(402).json(RESOURCE_DESCRIPTION);
});

// ✅ POST остаётся для теста вручную (через curl)
app.post("/verifyOwnership", (req, res) => {
  const { wallet, tokenId, txHash } = req.body;
  if (!wallet || !txHash || tokenId === undefined) {
    return res.status(400).send("Bad JSON");
  }

  return res.status(200).json({
    ...RESOURCE_DESCRIPTION,
    payer: wallet,
    accepts: RESOURCE_DESCRIPTION.accepts.map((a) => ({
      ...a,
      outputSchema: {
        ...a.outputSchema,
        output: {
          success: true,
          wallet,
          tokenId,
          verified: true,
          message: "Ownership verified (test mode)",
        },
      },
    })),
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GENGE API running on port ${port}`));
export default app;
