import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

type ShopStatus =
  | "active"
  | "paused"
  | "hidden";

type CreateShopBody = {
  shopName?: string;
  logoUrl?: string | null;
  phoneNumber?: string | null;
  bkashNumber?: string | null;
  email?: string;
  password?: string;
};

type UpdateShopBody = {
  shopId?: string;
  name?: string;
  logoUrl?: string | null;
  phoneNumber?: string | null;
  bkashNumber?: string | null;
  status?: ShopStatus;
};

function getServiceClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
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


/* =======================================================
   ADMIN CHECK
======================================================= */

async function getCurrentAdmin() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    return {
      supabase,
      user: null,
      error:
        "You must be logged in.",
      status: 401,
    };
  }

  const {
    data: isAdmin,
    error:
      adminError,
  } =
    await supabase.rpc(
      "current_user_is_admin"
    );

  if (adminError) {
    return {
      supabase,
      user,
      error:
        adminError.message,
      status: 500,
    };
  }

  if (isAdmin !== true) {
    return {
      supabase,
      user,
      error:
        "Only admin can manage shops.",
      status: 403,
    };
  }

  return {
    supabase,
    user,
    error: null,
    status: 200,
  };
}


/* =======================================================
   GET — LIST SHOPS
======================================================= */

export async function GET() {
  try {
    const admin =
      await getCurrentAdmin();

    if (admin.error) {
      return NextResponse.json(
        {
          error:
            admin.error,
        },
        {
          status:
            admin.status,
        }
      );
    }

    const serviceSupabase =
      getServiceClient();

    const {
      data: cafes,
      error,
    } =
      await serviceSupabase
        .from("cafes")
        .select(
          `
          id,
          name,
          logo_url,
          phone_number,
          bkash_number,
          owner_id,
          shopkeeper_id,
          status,
          is_active,
          created_at
          `
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      cafes:
        cafes ?? [],
    });
  } catch (error) {
    console.error(
      "Admin shops GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load shops.",
      },
      {
        status: 500,
      }
    );
  }
}


/* =======================================================
   POST — CREATE SHOP
======================================================= */

export async function POST(
  request: Request
) {
  let createdUserId:
    | string
    | null = null;

  try {
    const admin =
      await getCurrentAdmin();

    if (admin.error) {
      return NextResponse.json(
        {
          error:
            admin.error,
        },
        {
          status:
            admin.status,
        }
      );
    }

    const body =
      (await request.json()) as CreateShopBody;

    const shopName =
      body.shopName?.trim() ||
      "";

    const logoUrl =
      body.logoUrl?.trim() ||
      null;

    const phoneNumber =
      body.phoneNumber?.trim() ||
      null;

    const bkashNumber =
      body.bkashNumber?.trim() ||
      null;

    const email =
      body.email
        ?.trim()
        .toLowerCase() ||
      "";

    const password =
      body.password ||
      "";

    if (!shopName) {
      return NextResponse.json(
        {
          error:
            "Shop name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Shopkeeper email is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error:
            "Password must contain at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    const serviceSupabase =
      getServiceClient();

    /* ---------------------------------------------------
       Create Auth account
    --------------------------------------------------- */

    const {
      data: authData,
      error: authError,
    } =
      await serviceSupabase
        .auth.admin.createUser({
          email,
          password,
          email_confirm: true,

          user_metadata: {
            role: "shopkeeper",
            full_name:
              shopName,
          },
        });

    if (
      authError ||
      !authData.user
    ) {
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

    createdUserId =
      authData.user.id;

    /* ---------------------------------------------------
       Profile
    --------------------------------------------------- */

    const {
      error:
        profileError,
    } =
      await serviceSupabase
        .from("profiles")
        .upsert(
          {
            id:
              createdUserId,
            role:
              "shopkeeper",
            full_name:
              shopName,
          },
          {
            onConflict:
              "id",
          }
        );

    if (profileError) {
      await serviceSupabase.auth.admin.deleteUser(
        createdUserId
      );

      return NextResponse.json(
        {
          error:
            "Shopkeeper profile creation failed: " +
            profileError.message,
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------
       Cafe
    --------------------------------------------------- */

    const {
      data: cafe,
      error: cafeError,
    } =
      await serviceSupabase
        .from("cafes")
        .insert({
          name:
            shopName,

          logo_url:
            logoUrl,

          phone_number:
            phoneNumber,

          bkash_number:
            bkashNumber,

          owner_id:
            createdUserId,

          shopkeeper_id:
            createdUserId,

          status:
            "active",

          is_active:
            true,
        })
        .select(
          `
          id,
          name,
          logo_url,
          phone_number,
          bkash_number,
          owner_id,
          shopkeeper_id,
          status,
          is_active,
          created_at
          `
        )
        .single();

    if (
      cafeError ||
      !cafe
    ) {
      await serviceSupabase
        .from("profiles")
        .delete()
        .eq(
          "id",
          createdUserId
        );

      await serviceSupabase.auth.admin.deleteUser(
        createdUserId
      );

      return NextResponse.json(
        {
          error:
            "Shopkeeper account was created, but shop creation failed: " +
            (
              cafeError?.message ||
              "Unknown database error."
            ),
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Shop and shopkeeper account created successfully.",

        cafe,

        shopkeeper: {
          id:
            createdUserId,

          email,

          role:
            "shopkeeper",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Admin shops POST error:",
      error
    );

    if (createdUserId) {
      try {
        const serviceSupabase =
          getServiceClient();

        await serviceSupabase.auth.admin.deleteUser(
          createdUserId
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Shopkeeper Auth rollback error:",
          rollbackError
        );
      }
    }

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


/* =======================================================
   PATCH — EDIT / STATUS
======================================================= */

export async function PATCH(
  request: Request
) {
  try {
    const admin =
      await getCurrentAdmin();

    if (admin.error) {
      return NextResponse.json(
        {
          error:
            admin.error,
        },
        {
          status:
            admin.status,
        }
      );
    }

    const body =
      (await request.json()) as UpdateShopBody;

    const shopId =
      body.shopId?.trim() ||
      "";

    if (!shopId) {
      return NextResponse.json(
        {
          error:
            "Shop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const serviceSupabase =
      getServiceClient();

    const updateData: Record<
      string,
      unknown
    > = {};

    if (
      typeof body.name ===
      "string"
    ) {
      const name =
        body.name.trim();

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Shop name cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updateData.name =
        name;
    }

    if (
      body.logoUrl !==
      undefined
    ) {
      updateData.logo_url =
        body.logoUrl
          ?.trim() || null;
    }

    if (
      body.phoneNumber !==
      undefined
    ) {
      updateData.phone_number =
        body.phoneNumber
          ?.trim() || null;
    }

    if (
      body.bkashNumber !==
      undefined
    ) {
      updateData.bkash_number =
        body.bkashNumber
          ?.trim() || null;
    }

    if (
      body.status !==
      undefined
    ) {
      if (
        ![
          "active",
          "paused",
          "hidden",
        ].includes(
          body.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid shop status.",
          },
          {
            status: 400,
          }
        );
      }

      updateData.status =
        body.status;
    }

    if (
      Object.keys(
        updateData
      ).length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No shop changes were provided.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: cafe,
      error,
    } =
      await serviceSupabase
        .from("cafes")
        .update(
          updateData
        )
        .eq(
          "id",
          shopId
        )
        .select(
          `
          id,
          name,
          logo_url,
          phone_number,
          bkash_number,
          owner_id,
          shopkeeper_id,
          status,
          is_active,
          created_at
          `
        )
        .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Shop updated successfully.",

      cafe,
    });
  } catch (error) {
    console.error(
      "Admin shops PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update shop.",
      },
      {
        status: 500,
      }
    );
  }
}


/* =======================================================
   DELETE — PERMANENT SHOP DELETE
======================================================= */

export async function DELETE(
  request: Request
) {
  try {
    const admin =
      await getCurrentAdmin();

    if (admin.error) {
      return NextResponse.json(
        {
          error:
            admin.error,
        },
        {
          status:
            admin.status,
        }
      );
    }

    const shopId =
      new URL(request.url)
        .searchParams
        .get("id")
        ?.trim() || "";

    if (!shopId) {
      return NextResponse.json(
        {
          error:
            "Shop ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data,
      error,
    } =
      await admin.supabase.rpc(
        "admin_delete_cafe",
        {
          p_cafe_id:
            shopId,
        }
      );

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 400,
        }
      );
    }

    const serviceSupabase =
      getServiceClient();

    const shopkeeperId =
      data?.shopkeeper_id;

    if (
      shopkeeperId
    ) {
      const {
        error:
          authDeleteError,
      } =
        await serviceSupabase.auth.admin.deleteUser(
          shopkeeperId
        );

      if (
        authDeleteError
      ) {
        return NextResponse.json({
          success: true,

          warning:
            "Shop data was deleted, but the shopkeeper Auth account could not be deleted automatically: " +
            authDeleteError.message,

          data,
        });
      }
    }

    return NextResponse.json({
      success: true,

      message:
        "Shop and linked shopkeeper account were permanently deleted.",

      data,
    });
  } catch (error) {
    console.error(
      "Admin shops DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to permanently delete shop.",
      },
      {
        status: 500,
      }
    );
  }
}