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
                error: "Your session is invalid. Please log in again."
            });
        }

        const user = await authResponse.json();
        const amount = Number(req.body?.amount);

        if (
            !Number.isInteger(amount) ||
            amount < 100 ||
            amount > 1000000
        ) {
            return res.status(400).json({
                error: "Enter an amount between ₦100 and ₦1,000,000."
            });
        }

        if (!user.email) {
            return res.status(400).json({
                error: "Your account does not have an email address."
            });
        }

        const databaseHeaders = {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json"
        };

        const reference =
            "TOPUP-" + Date.now() + "-" +
            Math.random().toString(36).substring(2, 10);

        // Create pending wallet transaction
        const transactionResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/wallet_transactions`,
            {
                method: "POST",
                headers: {
                    ...databaseHeaders,
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    user_id: user.id,
                    amount_ngn: amount,
                    transaction_type: "topup",
                    status: "pending",
                    payment_reference: reference,
                    description: "Wallet top up through Paystack",
                    metadata: {
                        payment_provider: "paystack"
                    }
                })
            }
        );

        if (!transactionResponse.ok) {
            const details = await transactionResponse.text();

            console.error("SUPABASE TOPUP ERROR:", {
                status: transactionResponse.status,
                details
            });

            return res.status(500).json({
                error: "Supabase rejected the top-up transaction.",
                supabase_status: transactionResponse.status,
                supabase_details: details
            });
        }

        // Initialize Paystack
        const paymentResponse = await fetch(
            "https://api.paystack.co/transaction/initialize",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: user.email,
                    amount: amount * 100,
                    currency: "NGN",
                    reference,
                    callback_url:
                        "https://fundora-zeta.vercel.app/topup-callback.html"
                })
            }
        );

        const paymentData = await paymentResponse.json();

        if (!paymentResponse.ok || !paymentData.status) {

            await fetch(
                `${SUPABASE_URL}/rest/v1/wallet_transactions?payment_reference=eq.${encodeURIComponent(reference)}&status=eq.pending`,
                {
                    method: "PATCH",
                    headers: databaseHeaders,
                    body: JSON.stringify({
                        status: "failed",
                        completed_at: new Date().toISOString()
                    })
                }
            );

            return res.status(500).json({
                error: "Paystack initialization failed.",
                paystack_details: paymentData.message
            });
        }

        return res.status(200).json({
            success: true,
            authorization_url: paymentData.data.authorization_url,
            reference
        });

    } catch (error) {
        console.error("Top-up initialization error:", error);

        return res.status(500).json({
            error: error.message || "Unable to start top-up."
        });
    }
};
