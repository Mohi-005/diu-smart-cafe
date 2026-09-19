import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get(
      "SUPABASE_URL"
    );

    const supabaseAnonKey = Deno.env.get(
      "SUPABASE_ANON_KEY"
    );

    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    const resendApiKey = Deno.env.get(
      "RESEND_API_KEY"
    );

    const refundEmailFrom = Deno.env.get(
      "REFUND_EMAIL_FROM"
    );

    const shopkeeperEmail = Deno.env.get(
      "SHOPKEEPER_NOTIFICATION_EMAIL"
    );

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Supabase environment variables are missing."
      );
    }

    if (!resendApiKey) {
      throw new Error(
        "RESEND_API_KEY is missing."
      );
    }

    if (!refundEmailFrom) {
      throw new Error(
        "REFUND_EMAIL_FROM is missing."
      );
    }

    if (!shopkeeperEmail) {
      throw new Error(
        "SHOPKEEPER_NOTIFICATION_EMAIL is missing."
      );
    }

    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error(
        "Authorization header is missing."
      );
    }

    const userSupabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: {
        user,
      },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "You must be logged in."
      );
    }

    const body = await req.json();

    const orderId = body?.order_id;

    if (!orderId) {
      throw new Error(
        "order_id is required."
      );
    }

    const adminSupabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: order,
      error: orderError,
    } = await adminSupabase
      .from("orders")
      .select(
        `
        id,
        token_code,
        student_id,
        status,
        total_amount,
        cafe_id,
        created_at
        `
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      throw new Error(
        orderError.message
      );
    }

    if (!order) {
      throw new Error(
        "Order not found."
      );
    }

    if (order.student_id !== user.id) {
      throw new Error(
        "You are not allowed to notify this order."
      );
    }

    if (order.status !== "cancelled") {
      throw new Error(
        "The order is not cancelled."
      );
    }

    const {
      data: payment,
      error: paymentError,
    } = await adminSupabase
      .from("payments")
      .select(
        `
        id,
        amount,
        payment_method,
        transaction_id,
        status,
        payment_stage
        `
      )
      .eq("order_id", orderId)
      .eq("payment_stage", "advance")
      .maybeSingle();

    if (paymentError) {
      throw new Error(
        paymentError.message
      );
    }

    const {
      data: authUser,
      error: authUserError,
    } = await adminSupabase.auth.admin.getUserById(
      user.id
    );

    if (authUserError || !authUser?.user) {
      throw new Error(
        "Student email could not be loaded."
      );
    }

    const studentEmail =
      authUser.user.email;

    if (!studentEmail) {
      throw new Error(
        "Student email is missing."
      );
    }

    const tokenCode =
      order.token_code;

    const transactionId =
      payment?.transaction_id ||
      "Not available";

    const refundStatus =
      payment?.status ||
      "refund_pending";

    const subject =
      `DIU Smart Cafe - Order ${tokenCode} Cancelled`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>DIU Smart Cafe</h2>

        <p>
          Order <strong>${tokenCode}</strong>
          has been cancelled successfully.
        </p>

        <p>
          <strong>Order ID:</strong>
          ${order.id}
        </p>

        <p>
          <strong>Refund Amount:</strong>
          ৳${Number(
            payment?.amount || 0
          ).toFixed(2)}
        </p>

        <p>
          <strong>Payment Method:</strong>
          ${payment?.payment_method || "N/A"}
        </p>

        <p>
          <strong>Original Transaction ID:</strong>
          ${transactionId}
        </p>

        <p>
          <strong>Refund Status:</strong>
          ${refundStatus}
        </p>

        <p>
          The shopkeeper has been notified.
        </p>

        <p>
          Thank you for using DIU Smart Cafe.
        </p>
      </div>
    `;

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${resendApiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          from: refundEmailFrom,
          to: [
            studentEmail,
            shopkeeperEmail,
          ],
          subject,
          html,
        }),
      }
    );

    const resendData =
      await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(
        resendData?.message ||
          "Email sending failed."
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Cancellation email sent successfully.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error.";

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});