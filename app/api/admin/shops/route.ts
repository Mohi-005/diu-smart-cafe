import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

type CreateShopBody = {
  shopName?: string;
  logoUrl?: string | null;
  phoneNumber?: string;
  bkashNumber?: string;
  email?: string;
  password?: string;
};

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase server configuration is missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createServiceClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    /* -------------------------------------------------------
       1. Verify logged-in admin
    ------------------------------------------------------- */

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    /* -------------------------------------------------------
       2. Verify admin role
    ------------------------------------------------------- */

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (profile?.role !== "admin") {
      return NextResponse.json(
        {
          error: "Only admin can create shops.",
        },
        {
          status: 403,
        }
      );
    }

    /* -------------------------------------------------------
       3. Read and validate request
    ------------------------------------------------------- */

    const body = (await request.json()) as CreateShopBody;

    const shopName = body.shopName?.trim() || "";
    const logoUrl = body.logoUrl?.trim() || null;
    const phoneNumber = body.phoneNumber?.trim() || null;
    const bkashNumber = body.bkashNumber?.trim() || null;
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";

    if (!shopName) {
      return NextResponse.json(
        {
          error: "Shop name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error: "Shopkeeper email is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Password must contain at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    /* -------------------------------------------------------
       4. Create Supabase service-role client
    ------------------------------------------------------- */

    const serviceSupabase = getServiceClient();

    /* -------------------------------------------------------
       5. Create Auth user
    ------------------------------------------------------- */

    const {
      data: authData,
      error: authError,
    } =
      await serviceSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "shopkeeper",
          full_name: shopName,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Unable to create shopkeeper account.",
        },
        {
          status: 400,
        }
      );
    }

    createdUserId = authData.user.id;

    /* -------------------------------------------------------
       6. Create / update profile
    ------------------------------------------------------- */

    const {
      error: shopkeeperProfileError,
    } =
      await serviceSupabase
        .from("profiles")
        .upsert(
          {
            id: createdUserId,
            role: "shopkeeper",
            full_name: shopName,
          },
          {
            onConflict: "id",
          }
        );

    if (shopkeeperProfileError) {
      await serviceSupabase.auth.admin.deleteUser(
        createdUserId
      );

      return NextResponse.json(
        {
          error:
            "Shopkeeper account was created, but the profile could not be created: " +
            shopkeeperProfileError.message,
        },
        {
          status: 400,
        }
      );
    }

    /* -------------------------------------------------------
       7. Create cafe and link owner_id
    ------------------------------------------------------- */

    const {
      data: cafe,
      error: cafeError,
    } =
      await serviceSupabase
        .from("cafes")
        .insert({
          name: shopName,
          logo_url: logoUrl,
          phone_number: phoneNumber,
          bkash_number: bkashNumber,
          owner_id: createdUserId,
          is_active: true,
        })
        .select(
          "id, name, logo_url, phone_number, bkash_number, owner_id, is_active"
        )
        .single();

    if (cafeError || !cafe) {
      await serviceSupabase.auth.admin.deleteUser(
        createdUserId
      );

      return NextResponse.json(
        {
          error:
            "Shopkeeper account was created, but the cafe could not be created: " +
            (cafeError?.message || "Unknown database error."),
        },
        {
          status: 400,
        }
      );
    }

    /* -------------------------------------------------------
       8. Success
    ------------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,
        message: "Shop and shopkeeper account created successfully.",
        cafe,
        shopkeeper: {
          id: createdUserId,
          email,
          role: "shopkeeper",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Create shop error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create shop.",
      },
      {
        status: 500,
      }
    );
  }
}