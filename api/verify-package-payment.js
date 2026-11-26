const SUPABASE_URL = "https://dyfldeqbiqrkgligyhbe.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
"sb_publishable_rPbRPVDC0StngZ9-PHKFQA_4xk3jGrF";

module.exports = async (req, res) => {
if (req.method !== "POST") {
return res.status(405).json({
error: "Method not allowed"
});
}

try {
    const {
        PAYSTACK_SECRET_KEY,
        SUPABASE_SERVICE_ROLE_KEY
    } = process.env;

    if (!PAYSTACK_SECRET_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Payment configuration is incomplete.");
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Please log in first."
        });
    }

    const accessToken = authHeader.substring(7);
    const reference = req.body?.reference;

    if (!reference || typeof reference !== "string") {
        return res.status(400).json({
            error: "Payment reference is missing."
        });
    }

    // Verify member session
    const authResponse = await fetch(
        `${SUPABASE_URL}/auth/v1/user`,
        {
            headers: {
                apikey: SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    if (!authResponse.ok) {
        return res.status(401).json({
            error: "Your session is invalid."
        });
    }

    const user = await authResponse.json();
const databaseHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
};

    // Find this member's pending purchase
    const purchaseResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/package_purchases?payment_reference=eq.${encodeURIComponent(reference)}&user_id=eq.${user.id}&select=id,amount_ngn,payment_status,affiliate_packages(name)`,
        {
            headers: databaseHeaders
        }
    );

    if (!purchaseResponse.ok) {
        throw new Error("Could not retrieve purchase record.");
    }

    const purchases = await purchaseResponse.json();

    if (purchases.length !== 1) {
        return res.status(404).json({
            error: "Purchase record not found."
        });
    }

    const purchase = purchases[0];

    if (purchase.payment_status === "successful") {
        return res.status(200).json({
            success: true,
            message: "Payment was already verified.",
            package: purchase.affiliate_packages?.name
        });
    }

    if (purchase.payment_status !== "pending") {
        return res.status(400).json({
            error: "This purchase is not awaiting payment."
        });
    }

    // Ask Paystack to verify the transaction
    const verifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        }
    );

    const verification = await verifyResponse.json();

    if (
        !verifyResponse.ok ||
        !verification.status ||
        verification.data.status !== "success" ||
        verification.data.reference !== reference ||
        verification.data.currency !== "NGN" ||
        Number(verification.data.amount) !==
            Number(purchase.amount_ngn) * 100
    ) {
        return res.status(400).json({
            error: "Paystack has not confirmed this payment."
        });
    }

    // Mark the purchase successful only after verification
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
        throw new Error("Could not update the purchase record.");
    }

    const updatedPurchases = await updateResponse.json();

    if (updatedPurchases.length !== 1) {
        throw new Error("Purchase status could not be confirmed.");
    }

    return res.status(200).json({
        success: true,
        message: "Payment verified successfully.",
        package: purchase.affiliate_packages?.name
    });

} catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).json({
        error: error.message || "Payment verification failed."
    });
}

};
