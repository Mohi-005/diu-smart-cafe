import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type OrderAction =
  | "prepare"
  | "ready"
  | "remaining"
  | "collect";

type OrderActionBody = {
  action?: OrderAction;
  orderId?: string;
  paymentMethod?: string;
  transactionId?: string | null;
};

async function getCurrentShopkeeper() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      role: null,
      error: "You must be logged in.",
      status: 401,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      supabase,
      user,
      role: null,
      error: profileError.message,
      status: 500,
    };
  }

  if (!profile || !["shopkeeper", "admin"].includes(profile.role)) {
    return {
      supabase,
      user,
      role: null,
      error: "Only a shopkeeper or admin can manage shopkeeper orders.",
      status: 403,
    };
  }

  return {
    supabase,
    user,
    role: profile.role,
    error: null,
    status: 200,
  };
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createSupabaseAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function loadOrdersDirectly(userId: string, role: string) {
  const adminClient = getServiceRoleClient();

  let cafeQuery = adminClient
    .from("cafes")
    .select("id")
    .eq("is_active", true);

  if (role !== "admin") {
    cafeQuery = cafeQuery.or(
      `shopkeeper_id.eq.${userId},owner_id.eq.${userId}`
    );
  }

  const { data: cafes, error: cafeError } = await cafeQuery;

  if (cafeError) {
    throw new Error(cafeError.message);
  }

  const cafeIds = (cafes ?? []).map((cafe) => cafe.id as string);

  if (cafeIds.length === 0) {
    return [];
  }

  const { data: orderRows, error: orderError } = await adminClient
    .from("orders")
    .select(
      "id, token_code, cafe_id, status, total_amount, created_at, cancellation_deadline_at"
    )
    .in("cafe_id", cafeIds)
    .in("status", ["confirmed", "preparing", "ready"])
    .order("created_at", { ascending: false });

  if (orderError) {
    throw new Error(orderError.message);
  }

  const orders = orderRows ?? [];
  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id as string);

  const { data: paymentRows, error: paymentError } = await adminClient
    .from("payments")
    .select(
      "id, order_id, payment_stage, amount, status, payment_method, transaction_id, created_at"
    )
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  const paymentsByOrder = new Map<string, any[]>();

  for (const payment of paymentRows ?? []) {
    const orderId = payment.order_id as string;
    const list = paymentsByOrder.get(orderId) ?? [];
    list.push(payment);
    paymentsByOrder.set(orderId, list);
  }

  return orders.map((order) => {
    const orderPayments = paymentsByOrder.get(order.id as string) ?? [];

    const advancePayments = orderPayments.filter(
      (payment) => payment.payment_stage === "advance"
    );
    const remainingPayments = orderPayments.filter(
      (payment) => payment.payment_stage === "remaining"
    );

    const latestAdvance = advancePayments[0] ?? null;
    const latestRemaining = remainingPayments[0] ?? null;

    const paidAdvance = advancePayments.find(
      (payment) => payment.status === "paid"
    );

    const paidRemaining = remainingPayments.find(
      (payment) => payment.status === "paid"
    );

    const totalAmount = Number(order.total_amount ?? 0);
    const advancePaid = Number(paidAdvance?.amount ?? 0);
    const remainingPaid = Number(paidRemaining?.amount ?? 0);

    return {
      order_id: order.id,
      token_code: order.token_code,
      cafe_id: order.cafe_id,
      status: order.status,
      total_amount: totalAmount,
      advance_paid: advancePaid,
      remaining_due: Math.max(totalAmount - advancePaid - remainingPaid, 0),
      created_at: order.created_at,
      advance_payment_id: latestAdvance?.id ?? null,
      advance_payment_status: latestAdvance?.status ?? null,
      advance_payment_method: latestAdvance?.payment_method ?? null,
      advance_transaction_id: latestAdvance?.transaction_id ?? null,
      remaining_transaction_id: latestRemaining?.transaction_id ?? null,
      remaining_payment_method: latestRemaining?.payment_method ?? null,
      remaining_payment_status: latestRemaining?.status ?? null,
      cancellation_deadline_at: order.cancellation_deadline_at ?? null,
    };
  });
}

export async function GET() {
  try {
    const auth = await getCurrentShopkeeper();

    if (!auth.user || auth.error || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized." },
        {
          status: auth.status,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const orders = await loadOrdersDirectly(auth.user.id, auth.role);

    return NextResponse.json(
      { orders },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Shopkeeper orders GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load shopkeeper orders.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentShopkeeper();

    if (!auth.user || auth.error) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized." },
        { status: auth.status }
      );
    }

    const body = (await request.json()) as OrderActionBody;

    if (!body.action) {
      return NextResponse.json(
        { error: "Order action is required." },
        { status: 400 }
      );
    }

    if (!body.orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    let rpcName: string;
    let rpcArgs: Record<string, unknown>;

    switch (body.action) {
      case "prepare":
        rpcName = "prepare_instant_order";
        rpcArgs = { p_order_id: body.orderId };
        break;

      case "ready":
        rpcName = "update_shopkeeper_order_status";
        rpcArgs = {
          p_order_id: body.orderId,
          p_new_status: "ready",
        };
        break;

      case "remaining": {
        const paymentMethod = body.paymentMethod?.trim();
        const transactionId = body.transactionId?.trim() || null;

        if (
          !paymentMethod ||
          !["cash", "bkash", "nagad"].includes(paymentMethod)
        ) {
          return NextResponse.json(
            { error: "Valid remaining payment method is required." },
            { status: 400 }
          );
        }

        if (
          (paymentMethod === "bkash" || paymentMethod === "nagad") &&
          !transactionId
        ) {
          return NextResponse.json(
            { error: "Transaction ID is required for bKash or Nagad." },
            { status: 400 }
          );
        }

        rpcName = "mark_remaining_payment_paid";
        rpcArgs = {
          p_order_id: body.orderId,
          p_payment_method: paymentMethod,
          p_transaction_id: transactionId,
        };
        break;
      }

      case "collect":
        rpcName = "collect_order";
        rpcArgs = { p_order_id: body.orderId };
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported order action." },
          { status: 400 }
        );
    }

    const { error } = await auth.supabase.rpc(rpcName, rpcArgs);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shopkeeper orders POST error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete the order action.",
      },
      { status: 500 }
    );
  }
}
