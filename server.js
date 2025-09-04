// server.js
const express = require("express");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

// allow JSON + Form submissions
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", (req, res) => {
  res.send("✅ PhonePe Payment Gateway Server Running!");
});

// Create Payment API
app.post("/api/create-payment", async (req, res) => {
  try {
    const { product, amountINR, customerName, phone, email, redirectUrl } = req.body;

    if (!amountINR || !redirectUrl) {
      return res.status(400).json({ error: "amountINR and redirectUrl required" });
    }

    // convert INR → paise
    const amountPaise = parseInt(amountINR) * 100;

    // unique order ID
    const merchantOrderId = "ORD" + Date.now();

    // build payload
    const payload = {
      merchantId: process.env.MERCHANT_ID,
      merchantTransactionId: merchantOrderId,
      amount: amountPaise,
      redirectUrl,
      redirectMode: "POST",
      mobileNumber: phone || "9999999999",
      paymentInstrument: { type: "PAY_PAGE" }
    };

    // encode + checksum
    const data = Buffer.from(JSON.stringify(payload)).toString("base64");
    const checksum = crypto
      .createHash("sha256")
      .update(data + "/pg/v1/pay" + process.env.SALT_KEY)
      .digest("hex") + "###" + process.env.SALT_INDEX;

    // call PhonePe
    const response = await fetch(process.env.PHONEPE_BASE + "/pg/v1/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      body: JSON.stringify({ request: data }),
    });

    const result = await response.json();

    // redirect customer
    if (
      result.data &&
      result.data.instrumentResponse &&
      result.data.instrumentResponse.redirectInfo &&
      result.data.instrumentResponse.redirectInfo.url
    ) {
      return res.redirect(result.data.instrumentResponse.redirectInfo.url);
    } else {
      return res.status(500).json({ error: "PhonePe init failed", details: result });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server crash", details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
