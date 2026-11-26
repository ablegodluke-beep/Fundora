const crypto = require("crypto");

const SUPABASE_URL =
    "https://dyfldeqbiqrkgligyhbe.supabase.co";

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

        // Read original request body
        const chunks = [];

        for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
        }

        const rawBody = Buffer.concat(chunks);

        const signature = req.headers["x-paystack-signature"];

        if (!signature) {
            return res.status(401).send("Missing signature");
        }

        // Verify Paystack signature
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

        // FIRST: Check package purchases
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

        if (purchases.length > 1) {
            return res.status(409).send("Duplicate purchase reference");
        }

        if (purchases.length === 1) {
            const purchase = purchases[0];

            if (
                Number(payment.amount) !==
                Number(purchase.amount_ngn) * 100
            ) {
                return res.status(400).send("Payment amount mismatch");
            }

            if (purchase.payment_status === "successful") {
                return res.status(200).send("Package payment already recorded");
            }

            if (purchase.payment_status !== "pending") {
                return res.status(200).send("Purchase is not pending");
            }

            const updateResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/package_purchases?id=eq.${encodeURIComponent(purchase.id)}&payment_status=eq.pending`,
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
                throw new Error("Could not update package purchase");
            }

            const updated = await updateResponse.json();

            if (!updated.length) {
                return res.status(200).send("Package payment already processed");
            }

            return res.status(200).send("Package payment recorded");
        }

        // SECOND: Check wallet top-ups
        const topupResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/wallet_transactions?payment_reference=eq.${encodeURIComponent(reference)}&transaction_type=eq.topup&select=id,user_id,amount_ngn,status`,
            {
                headers: databaseHeaders
            }
        );

        if (!topupResponse.ok) {
            throw new Error("Could not retrieve wallet top-up");
        }

        const topups = await topupResponse.json();

        if (topups.length > 1) {
            return res.status(409).send("Duplicate top-up reference");
        }

        if (topups.length === 0) {
            return res.status(404).send("Payment record not found");
        }

        const topup = topups[0];

        // Confirm exact amount
        if (
            Number(payment.amount) !==
            Number(topup.amount_ngn) * 100
        ) {
            return res.status(400).send("Top-up amount mismatch");
        }

        // Prevent duplicate wallet credit
        if (topup.status === "successful") {
            return res.status(200).send("Top-up already recorded");
        }

        if (topup.status !== "pending") {
            return res.status(200).send("Top-up is not pending");
        }

        // Mark the existing wallet transaction successful
        const updateTopupResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/wallet_transactions?id=eq.${encodeURIComponent(topup.id)}&status=eq.pending`,
            {
                method: "PATCH",
                headers: {
                    ...databaseHeaders,
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    status: "successful",
                    completed_at: new Date().toISOString()
                })
            }
        );

        if (!updateTopupResponse.ok) {
            throw new Error("Could not update wallet top-up");
        }

        const updatedTopups = await updateTopupResponse.json();

        if (!updatedTopups.length) {
            return res.status(200).send("Top-up already processed");
        }

        return res.status(200).send("Wallet top-up recorded");

    } catch (error) {
        console.error("Paystack webhook error:", error);

        return res.status(500).send("Webhook processing failed");
    }
};

// Disable automatic body parsing
module.exports.config = {
    api: {
        bodyParser: false
    }
};
