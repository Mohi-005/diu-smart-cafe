import { NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type OrderAction =
  | "prepare"
  | "ready"
  | "remaining"
  | "collect";

type OrderActionBody = {
  action?: OrderAction;
  orderId?: string;
  paymentMethod?: string;
  transactionId?: string;
};

type ShopkeeperOrder = {
  order_id: string;
  token_code: string;
  cafe_id: string;
  status: string;
  total_amount: number;
  advance_paid: number;
  remaining_due: number;
  created_at: string;
  cancellation_deadline_at: string | null;

  advance_payment_id: string | null;
  advance_payment_status: string | null;
  advance_payment_method: string | null;
  advance_transaction_id: string | null;

  remaining_transaction_id: string | null;
  remaining_payment_method: string | null;
  remaining_payment_status: string | null;

  student_name: string | null;
  student_phone: string | null;
};

type AuthResult = {
  user: {
    id: string;
  } | null;
  role: string | null;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  error?: string;
  status: number;
};

async function getCurrentShopkeeper(): Promise<AuthResult> {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      role: null,
      supabase,
      error: "Unauthorized.",
      status: 401,
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    return {
      user: null,
      role: null,
      supabase,
      error: profileError.message,
      status: 500,
    };
  }

  const role = profile?.role ?? null;

  if (role !== "shopkeeper" && role !== "admin") {
    return {
      user: null,
      role,
      supabase,
      error: "You are not authorized to manage shop orders.",
      status: 403,
    };
  }

  return {
    user: {
      id: user.id,
    },
    role,
    supabase,
    status: 200,
  };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase server environment variables are missing."
    );
  }

  return createServiceClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function loadOrdersDirectly(
  userId: string,
  role: string
): Promise<ShopkeeperOrder[]> {
  const serviceSupabase = getServiceClient();

  /* -------------------------------------------------------
     1. Find the shopkeeper's own cafe(s)
  ------------------------------------------------------- */

  let cafeQuery = serviceSupabase
    .from("cafes")
    .select("id, shopkeeper_id, owner_id")
    .eq("is_active", true);

  if (role !== "admin") {
    const ownershipFilter =
      "shopkeeper_id.eq." +
      userId +
      ",owner_id.eq." +
      userId;

    cafeQuery = cafeQuery.or(ownershipFilter);
  }

  const {
    data: cafes,
    error: cafeError,
  } = await cafeQuery;

  if (cafeError) {
    throw new Error(cafeError.message);
  }

  if (!cafes || cafes.length === 0) {
    return [];
  }

  const cafeIds = cafes.map((cafe) => cafe.id);

  /* -------------------------------------------------------
     2. Load orders from those cafes
  ------------------------------------------------------- */

  const {
    data: orders,
    error: ordersError,
  } = await serviceSupabase
    .from("orders")
    .select(
      `
        id,
        token_code,
        cafe_id,
        student_id,
        status,
        total_amount,
        created_at,
        cancellation_deadline_at
      `
    )
    .in("cafe_id", cafeIds)
    .in("status", [
      "confirmed",
      "preparing",
      "ready",
    ])
    .order("created_at", {
      ascending: false,
    });

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  if (!orders || orders.length === 0) {
    return [];
  }

  /* -------------------------------------------------------
     3. Load students
  ------------------------------------------------------- */

  const studentIds = [
    ...new Set(
      orders
        .map((order) => order.student_id)
        .filter(Boolean)
    ),
  ];

  const {
    data: profiles,
    error: profilesError,
  } = studentIds.length
    ? await serviceSupabase
        .from("profiles")
        .select("id, full_name, phone_number")
        .in("id", studentIds)
    : {
        data: [],
        error: null,
      };

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileMap = new Map<
    string,
    {
      full_name: string | null;
      phone_number: string | null;
    }
  >();

  for (const profile of profiles ?? []) {
    profileMap.set(profile.id, {
      full_name: profile.full_name ?? null,
      phone_number: profile.phone_number ?? null,
    });
  }

  /* -------------------------------------------------------
     4. Load payments
  ------------------------------------------------------- */

  const orderIds = orders.map(
    (order) => order.id
  );

  const {
    data: payments,
    error: paymentsError,
  } = await serviceSupabase
    .from("payments")
    .select(
      `
        id,
        order_id,
        payment_stage,
        amount,
        status,
        payment_method,
        transaction_id,
        created_at
      `
    )
    .in("order_id", orderIds)
    .order("created_at", {
      ascending: false,
    });

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  /* -------------------------------------------------------
     5. Build order/payment data
  ------------------------------------------------------- */

  return orders.map((order) => {
    const orderPayments = (payments ?? []).filter(
      (payment) =>
        payment.order_id === order.id
    );

    const advancePayments =
      orderPayments.filter(
        (payment) =>
          payment.payment_stage === "advance"
      );

    const remainingPayments =
      orderPayments.filter(
        (payment) =>
          payment.payment_stage === "remaining"
      );

    const latestAdvance =
      advancePayments[0] ?? null;

    const latestRemaining =
      remainingPayments[0] ?? null;

    const paidAdvance =
      advancePayments.find(
        (payment) =>
          payment.status === "paid"
      );

    const paidRemaining =
      remainingPayments.find(
        (payment) =>
          payment.status === "paid"
      );

    const totalAmount =
      Number(order.total_amount ?? 0);

    const advancePaid = Number(
      paidAdvance?.amount ?? 0
    );

    const remainingPaid = Number(
      paidRemaining?.amount ?? 0
    );

    const student = order.student_id
      ? profileMap.get(order.student_id)
      : null;

    return {
      order_id: order.id,
      token_code: order.token_code,
      cafe_id: order.cafe_id,
      status: order.status,
      total_amount: totalAmount,

      advance_paid: advancePaid,

      remaining_due: Math.max(
        totalAmount -
          advancePaid -
          remainingPaid,
        0
      ),

      created_at: order.created_at,

      cancellation_deadline_at:
        order.cancellation_deadline_at ??
        null,

      advance_payment_id:
        latestAdvance?.id ?? null,

      advance_payment_status:
        latestAdvance?.status ?? null,

      advance_payment_method:
        latestAdvance?.payment_method ?? null,

      advance_transaction_id:
        latestAdvance?.transaction_id ?? null,

      remaining_transaction_id:
        latestRemaining?.transaction_id ?? null,

      remaining_payment_method:
        latestRemaining?.payment_method ?? null,

      remaining_payment_status:
        latestRemaining?.status ?? null,

      student_name:
        student?.full_name ?? null,

      student_phone:
        student?.phone_number ?? null,
    };
  });
}

export async function GET() {
  try {
    const auth =
      await getCurrentShopkeeper();

    if (
      !auth.user ||
      auth.error ||
      !auth.role
    ) {
      return NextResponse.json(
        {
          error:
            auth.error ||
            "Unauthorized.",
        },
        {
          status: auth.status,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const orders =
      await loadOrdersDirectly(
        auth.user.id,
        auth.role
      );

    return NextResponse.json(
      {
        orders,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Shopkeeper orders GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load shopkeeper orders.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const auth =
      await getCurrentShopkeeper();

    if (!auth.user || auth.error) {
      return NextResponse.json(
        {
          error:
            auth.error ||
            "Unauthorized.",
        },
        {
          status: auth.status,
        }
      );
    }

    const body =
      (await request.json()) as OrderActionBody;

    if (!body.action) {
      return NextResponse.json(
        {
          error:
            "Order action is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!body.orderId) {
      return NextResponse.json(
        {
          error:
            "Order ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    let rpcName: string;
    let rpcArgs: Record<
      string,
      unknown
    >;

    switch (body.action) {
      case "prepare":
        rpcName =
          "prepare_instant_order";

        rpcArgs = {
          p_order_id:
            body.orderId,
        };
        break;

      case "ready":
        rpcName =
          "update_shopkeeper_order_status";

        rpcArgs = {
          p_order_id:
            body.orderId,
          p_new_status:
            "ready",
        };
        break;

      case "remaining": {
        const paymentMethod =
          body.paymentMethod?.trim();

        const transactionId =
          body.transactionId?.trim() ||
          null;

        if (
          !paymentMethod ||
          ![
            "cash",
            "bkash",
            "nagad",
          ].includes(paymentMethod)
        ) {
          return NextResponse.json(
            {
              error:
                "Valid remaining payment method is required.",
            },
            {
              status: 400,
            }
          );
        }

        if (
          (
            paymentMethod ===
              "bkash" ||
            paymentMethod ===
              "nagad"
          ) &&
          !transactionId
        ) {
          return NextResponse.json(
            {
              error:
                "Transaction ID is required for bKash or Nagad.",
            },
            {
              status: 400,
            }
          );
        }

        rpcName =
          "mark_remaining_payment_paid";

        rpcArgs = {
          p_order_id:
            body.orderId,
          p_payment_method:
            paymentMethod,
          p_transaction_id:
            transactionId,
        };

        break;
      }

      case "collect":
        rpcName =
          "collect_order";

        rpcArgs = {
          p_order_id:
            body.orderId,
        };

        break;

      default:
        return NextResponse.json(
          {
            error:
              "Unsupported order action.",
          },
          {
            status: 400,
          }
        );
    }

    const {
      error,
    } = await auth.supabase.rpc(
      rpcName,
      rpcArgs
    );

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Shopkeeper orders POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update order.",
      },
      {
        status: 500,
      }
    );
  }
}