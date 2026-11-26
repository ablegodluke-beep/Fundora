
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
            return res.status(500).json({
                error: "Payment configuration is incomplete."
            });
        }

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Please log in first."
            });
        }

        const accessToken = authHeader.substring(7);

        // Verify the logged-in member
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

        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({
                error: "Invalid package amount."
            });
        }
const databaseHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
};
        

        // Find the active package in Supabase
        const packageResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/affiliate_packages?price_ngn=eq.${amount}&is_active=eq.true&select=id,name,price_ngn`,
            {
                headers: databaseHeaders
            }
        );
if (!packageResponse.ok) {
    const errorDetails = await packageResponse.text();

    return res.status(500).json({
        error: "Supabase package lookup failed",
        supabase_status: packageResponse.status,
        supabase_details: errorDetails
    });
}

        const packages = await packageResponse.json();
       
    

        if (packages.length !== 1) {
            return res.status(404).json({
                error: "This package is unavailable."
            });
        }

        const selectedPackage = packages[0];

        const reference =
            "FUN-" + Date.now() + "-" +
            Math.random().toString(36).substring(2, 10);

        // Create a pending purchase record
        const purchaseResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/package_purchases`,
            {
                method: "POST",
                headers: {
                    ...databaseHeaders,
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    user_id: user.id,
                    package_id: selectedPackage.id,
                    amount_ngn: selectedPackage.price_ngn,
                    payment_reference: reference,
                    payment_status: "pending"
                })
            }
        );

        if (!purchaseResponse.ok) {
            throw new Error("Could not create your purchase record.");
        }

        // Initialize Paystack checkout
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
                    amount: selectedPackage.price_ngn * 100,
                    currency: "NGN",
                    reference,
                    callback_url:
                        "https://fundora-zeta.vercel.app/payment-callback.html"
                })
            }
        );

        const paymentData = await paymentResponse.json();

        if (!paymentResponse.ok || !paymentData.status) {
            throw new Error(
                paymentData.message || "Paystack initialization failed."
            );
        }

        return res.status(200).json({
            authorization_url:
                paymentData.data.authorization_url,
            reference
        });

    } catch (error) {
        console.error("Payment initialization error:", error);

        return res.status(500).json({
            error: error.message || "Unable to start payment."
        });
    }
};
