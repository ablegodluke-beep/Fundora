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

        const reference = String(
            req.body?.reference || ""
        ).trim();

        if (!reference) {
            return res.status(400).json({
                error: "Payment reference is missing."
            });
        }

        const databaseHeaders = {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json"
        };

        // Find this user's top-up transaction
        const transactionResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/wallet_transactions?user_id=eq.${encodeURIComponent(user.id)}&payment_reference=eq.${encodeURIComponent(reference)}&transaction_type=eq.topup&select=id,user_id,amount_ngn,status,payment_reference`,
            {
                headers: databaseHeaders
            }
        );

        if (!transactionResponse.ok) {
            throw new Error("Could not retrieve your top-up record.");
        }

        const transactions = await transactionResponse.json();

        if (!transactions.length) {
            return res.status(404).json({
                error: "Top-up transaction was not found."
            });
        }

        const transaction = transactions[0];

        // Avoid crediting the same payment twice
        if (transaction.status === "successful") {
            return res.status(200).json({
                success: true,
                message: "Your wallet has already been credited."
            });
        }

        if (transaction.status !== "pending") {
            return res.status(400).json({
                error: "This top-up is no longer pending."
            });
        }

        // Verify payment directly with Paystack
        const paystackResponse = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const paystackData = await paystackResponse.json();

        if (!paystackResponse.ok || !paystackData.status) {
            throw new Error("Could not verify payment with Paystack.");
        }

        const payment = paystackData.data;

        if (
            payment.status !== "success" ||
            payment.reference !== reference ||
            payment.currency !== "NGN" ||
            Number(payment.amount) !== Number(transaction.amount_ngn) * 100
        ) {
            return res.status(400).json({
                error: "Payment could not be confirmed. Please contact support if you were charged."
            });
        }

        // Mark the existing transaction successful
        const updateResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/wallet_transactions?id=eq.${encodeURIComponent(transaction.id)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
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

        if (!updateResponse.ok) {
            throw new Error("Payment was verified, but wallet updating failed.");
        }

        const updatedRows = await updateResponse.json();

        if (!updatedRows.length) {
            // Check whether another verification already completed it
            const checkResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/wallet_transactions?id=eq.${encodeURIComponent(transaction.id)}&user_id=eq.${encodeURIComponent(user.id)}&select=status`,
                {
                    headers: databaseHeaders
                }
            );

            const checkRows = await checkResponse.json();

            if (
                !checkResponse.ok ||
                !checkRows.length ||
                checkRows[0].status !== "successful"
            ) {
                throw new Error("Wallet credit could not be confirmed.");
            }
        }

        return res.status(200).json({
            success: true,
            message: "Payment successful. Your wallet has been credited."
        });

    } catch (error) {
        console.error("Top-up verification error:", error);

        return res.status(500).json({
            error: error.message || "Unable to verify top-up."
        });
    }
};
