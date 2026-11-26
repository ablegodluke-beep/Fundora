const crypto = require("crypto");

const SUPABASE_URL = "https://dyfldeqbiqrkgligyhbe.supabase.co";

module.exports = async (req, res) => {
if (req.method !== "POST") {
return res.status(405).send("Method not allowed");
}

try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!secret || !serviceKey) {
        return res.status(500).send("Server configuration error");
    }

    // Read the original request body for signature verification
    const chunks = [];

    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks);

    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
        return res.status(401).send("Missing signature");
    }

    const expectedSignature = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

    const received = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");

    if (
        received.length !== expected.length ||
        !crypto.timingSafeEqual(received, expected)
    ) {
        return res.status(401).send("Invalid signature");
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    // We only process successful charges
    if (event.event !== "charge.success") {
        return res.status(200).send("Event received");
    }

    const payment = event.data;
    const reference = payment.reference;

    if (
        !reference ||
        payment.status !== "success" ||
        payment.currency !== "NGN"
    ) {
        return res.status(400).send("Invalid payment details");
    }
const databaseHeaders = {
    apikey: serviceKey,
    "Content-Type": "application/json"
};

    // Find the matching Fundora purchase
    const purchaseResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/package_purchases?payment_reference=eq.${encodeURIComponent(reference)}&select=id,amount_ngn,payment_status`,
        {
            headers: databaseHeaders
        }
    );

    if (!purchaseResponse.ok) {
        throw new Error("Could not retrieve purchase record");
    }

    const purchases = await purchaseResponse.json();

    if (purchases.length !== 1) {
        return res.status(404).send("Purchase not found");
    }

    const purchase = purchases[0];

    // Confirm the amount matches the package purchase
    if (Number(payment.amount) !== Number(purchase.amount_ngn) * 100) {
        return res.status(400).send("Payment amount mismatch");
    }

    // Safe to receive the same webhook more than once
    if (purchase.payment_status === "successful") {
        return res.status(200).send("Payment already recorded");
    }

    if (purchase.payment_status !== "pending") {
        return res.status(200).send("Purchase is not pending");
    }

    // Record success only after signature and payment checks
    const updateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/package_purchases?id=eq.${purchase.id}&payment_status=eq.pending`,
        {
            method: "PATCH",
            headers: {
                ...databaseHeaders,
                Prefer: "return=representation"
            },
            body: JSON.stringify({
                payment_status: "successful",
                paid_at: new Date().toISOString()
            })
        }
    );

    if (!updateResponse.ok) {
        throw new Error("Could not update purchase status");
    }

    return res.status(200).send("Payment recorded");

} catch (error) {
    console.error("Paystack webhook error:", error);
    return res.status(500).send("Webhook processing failed");
}

};

// Disable automatic body parsing so the original body can be verified
module.exports.config = {
api: {
bodyParser: false
}
};
