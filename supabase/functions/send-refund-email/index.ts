import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const refundEmailFrom = Deno.env.get("REFUND_EMAIL_FROM");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Supabase environment variables are missing.");
    }

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is missing.");
    }

    if (!refundEmailFrom) {
      throw new Error("REFUND_EMAIL_FROM is missing.");
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Authorization header is missing.");
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
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      throw new Error("You must be logged in.");
    }

    const body = await req.json();
    const paymentId = body?.payment_id;

    if (!paymentId) {
      throw new Error("payment_id is required.");
    }

    const adminSupabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data: payment, error: paymentError } =
      await adminSupabase
        .from("payments")
        .select(
          `
          id,
          order_id,
          student_id,
          amount,
          cashout_fee_amount,
          payment_method,
          transaction_id,
          refund_method,
          refund_transaction_id,
          status,
          payment_stage
          `
        )
        .eq("id", paymentId)
        .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (!payment) {
      throw new Error("Payment not found.");
    }

    if (payment.status !== "refunded") {
      throw new Error(
        "This payment has not been marked as refunded."
      );
    }

    if (payment.payment_stage !== "advance") {
      throw new Error(
        "Only advance refund emails are supported."
      );
    }

    const { data: order, error: orderError } =
      await adminSupabase
        .from("orders")
        .select(
          `
          id,
          token_code,
          student_id,
          status
          `
        )
        .eq("id", payment.order_id)
        .maybeSingle();

    if (orderError) {
      throw new Error(orderError.message);
    }

    if (!order) {
      throw new Error("Order not found.");
    }

    if (order.status !== "cancelled") {
      throw new Error(
        "Refund email can only be sent for a cancelled order."
      );
    }

    const { data: history, error: historyError } =
      await adminSupabase
        .from("refund_history")
        .select(
          `
          id,
          refunded_by,
          refund_method,
          refund_transaction_id,
          refunded_at
          `
        )
        .eq("payment_id", paymentId)
        .maybeSingle();

    if (historyError) {
      throw new Error(historyError.message);
    }

    if (!history) {
      throw new Error(
        "Completed refund history was not found."
      );
    }

    if (history.refunded_by !== user.id) {
      throw new Error(
        "You are not allowed to send this refund email."
      );
    }

    const {
      data: authStudent,
      error: studentError,
    } = await adminSupabase.auth.admin.getUserById(
      order.student_id
    );

    if (studentError || !authStudent?.user) {
      throw new Error(
        "Student account could not be loaded."
      );
    }

    const studentEmail = authStudent.user.email;

    if (!studentEmail) {
      throw new Error("Student email is missing.");
    }

    const subject =
      `DIU Smart Cafe - Refund Completed - ${order.token_code}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.7;">
        <h2>DIU Smart Cafe</h2>

        <p>
          Your refund for order
          <strong>${order.token_code}</strong>
          has been completed.
        </p>

        <p>
          <strong>Refund Amount:</strong>
          ৳${Number(payment.amount).toFixed(2)}
        </p>

        <p>
          <strong>Payment Method:</strong>
          ${payment.payment_method || "N/A"}
        </p>

        <p>
          <strong>Original Transaction ID:</strong>
          ${payment.transaction_id || "N/A"}
        </p>

        <p>
          <strong>Cash-out Fee:</strong>
          ৳${Number(payment.cashout_fee_amount || 0).toFixed(2)}
        </p>

        <p>
          <strong>Refund Method:</strong>
          ${history.refund_method || payment.refund_method || "N/A"}
        </p>

        <p>
          <strong>Refund Transaction ID:</strong>
          ${history.refund_transaction_id || payment.refund_transaction_id || "N/A"}
        </p>

        <p>
          <strong>Refund Completed At:</strong>
          ${history.refunded_at}
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
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: refundEmailFrom,
          to: [studentEmail],
          subject,
          html,
        }),
      }
    );

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(
        resendData?.message || "Refund email sending failed."
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Refund email sent successfully.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
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
          "Content-Type": "application/json",
        },
      }
    );
  }
});
