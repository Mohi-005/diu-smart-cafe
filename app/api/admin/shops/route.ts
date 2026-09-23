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

const CAFE_LOGO_BUCKET = "food-images";
const MAX_CAFE_LOGO_SIZE = 5 * 1024 * 1024;

function getSafeFileName(fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safeName || "cafe-logo";
}

function validateLogoFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    throw new Error("Cafe logo image is required.");
  }

  if (!value.type.startsWith("image/")) {
    throw new Error("Please upload a valid image file for the cafe logo.");
  }

  if (value.size > MAX_CAFE_LOGO_SIZE) {
    throw new Error("Cafe logo image size must be 5 MB or less.");
  }

  return value;
}

async function uploadCafeLogo(
  serviceSupabase: SupabaseClient,
  cafeId: string,
  file: File
) {
  const filePath = `cafe-logos/${cafeId}/${crypto.randomUUID()}-${getSafeFileName(file.name)}`;

  const { error: uploadError } = await serviceSupabase.storage
    .from(CAFE_LOGO_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `Cafe logo upload failed: ${uploadError.message}`
    );
  }

  const { data: publicUrlData } = serviceSupabase.storage
    .from(CAFE_LOGO_BUCKET)
    .getPublicUrl(filePath);

  if (!publicUrlData?.publicUrl) {
    await serviceSupabase.storage
      .from(CAFE_LOGO_BUCKET)
      .remove([filePath]);
    throw new Error("Unable to create a public URL for the cafe logo.");
  }

  return {
    filePath,
    publicUrl: publicUrlData.publicUrl,
  };
}

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
  let createdUserId: string | null = null;
  let createdCafeId: string | null = null;
  let uploadedLogoPath: string | null = null;

  try {
    const admin = await getCurrentAdmin();

    if (admin.error) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status }
      );
    }

    const formData = await request.formData();

    const shopName = String(formData.get("shopName") ?? "").trim();
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim() || null;
    const bkashNumber = String(formData.get("bkashNumber") ?? "").trim() || null;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const logoFile = validateLogoFile(formData.get("logo"));

    if (!shopName) {
      return NextResponse.json(
        { error: "Shop name is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Shopkeeper email is required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must contain at least 8 characters." },
        { status: 400 }
      );
    }

    const serviceSupabase = getServiceClient();

    /* ---------------------------------------------------
       Create Auth account
    --------------------------------------------------- */
    const { data: authData, error: authError } =
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
        { status: 400 }
      );
    }

    createdUserId = authData.user.id;

    /* ---------------------------------------------------
       Profile
    --------------------------------------------------- */
    const { error: profileError } = await serviceSupabase
      .from("profiles")
      .upsert(
        {
          id: createdUserId,
          role: "shopkeeper",
          full_name: shopName,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw new Error(
        "Shopkeeper profile creation failed: " +
          profileError.message
      );
    }

    /* ---------------------------------------------------
       Cafe row first so the storage path can use the real cafe ID.
    --------------------------------------------------- */
    const { data: cafe, error: cafeError } = await serviceSupabase
      .from("cafes")
      .insert({
        name: shopName,
        logo_url: null,
        phone_number: phoneNumber,
        bkash_number: bkashNumber,
        owner_id: createdUserId,
        shopkeeper_id: createdUserId,
        status: "active",
        is_active: true,
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

    if (cafeError || !cafe) {
      throw new Error(
        "Shopkeeper account was created, but shop creation failed: " +
          (cafeError?.message || "Unknown database error.")
      );
    }

    createdCafeId = cafe.id as string;

    /* ---------------------------------------------------
       Upload logo and save the resulting public URL.
       The existing food-images bucket is reused.
    --------------------------------------------------- */
    const uploadedLogo = await uploadCafeLogo(
      serviceSupabase,
      createdCafeId,
      logoFile
    );
    uploadedLogoPath = uploadedLogo.filePath;

    const { data: updatedCafe, error: logoUpdateError } =
      await serviceSupabase
        .from("cafes")
        .update({ logo_url: uploadedLogo.publicUrl })
        .eq("id", createdCafeId)
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

    if (logoUpdateError || !updatedCafe) {
      throw new Error(
        "Cafe was created, but saving the cafe logo failed: " +
          (logoUpdateError?.message || "Unknown database error.")
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Shop and shopkeeper account created successfully.",
        cafe: updatedCafe,
        shopkeeper: {
          id: createdUserId,
          email,
          role: "shopkeeper",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin shops POST error:", error);

    try {
      const serviceSupabase = getServiceClient();

      if (uploadedLogoPath) {
        await serviceSupabase.storage
          .from(CAFE_LOGO_BUCKET)
          .remove([uploadedLogoPath]);
      }

      if (createdCafeId) {
        await serviceSupabase
          .from("cafes")
          .delete()
          .eq("id", createdCafeId);
      }

      if (createdUserId) {
        await serviceSupabase
          .from("profiles")
          .delete()
          .eq("id", createdUserId);

        await serviceSupabase.auth.admin.deleteUser(createdUserId);
      }
    } catch (rollbackError) {
      console.error("Admin shops POST rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create shop.",
      },
      { status: 500 }
    );
  }
}


/* =======================================================
   PATCH — EDIT / STATUS
======================================================= */

export async function PATCH(
  request: Request
) {
  let uploadedLogoPath: string | null = null;

  try {
    const admin = await getCurrentAdmin();

    if (admin.error) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status }
      );
    }

    const formData = await request.formData();

    const shopId = String(formData.get("shopId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
    const bkashNumber = String(formData.get("bkashNumber") ?? "").trim();
    const statusValue = String(formData.get("status") ?? "").trim();
    const logoValue = formData.get("logo");

    if (!shopId) {
      return NextResponse.json(
        { error: "Shop ID is required." },
        { status: 400 }
      );
    }

    const serviceSupabase = getServiceClient();

    const updateData: Record<string, unknown> = {};

    if (formData.has("name")) {
      if (!name) {
        return NextResponse.json(
          { error: "Shop name cannot be empty." },
          { status: 400 }
        );
      }
      updateData.name = name;
    }

    if (formData.has("phoneNumber")) {
      updateData.phone_number = phoneNumber || null;
    }

    if (formData.has("bkashNumber")) {
      updateData.bkash_number = bkashNumber || null;
    }

    if (formData.has("status")) {
      if (!(["active", "paused", "hidden"] as string[]).includes(statusValue)) {
        return NextResponse.json(
          { error: "Invalid shop status." },
          { status: 400 }
        );
      }
      updateData.status = statusValue as ShopStatus;
    }

    if (logoValue instanceof File && logoValue.size > 0) {
      const logoFile = validateLogoFile(logoValue);
      const uploadedLogo = await uploadCafeLogo(
        serviceSupabase,
        shopId,
        logoFile
      );
      uploadedLogoPath = uploadedLogo.filePath;
      updateData.logo_url = uploadedLogo.publicUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No shop changes were provided." },
        { status: 400 }
      );
    }

    const { data: cafe, error } = await serviceSupabase
      .from("cafes")
      .update(updateData)
      .eq("id", shopId)
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
      if (uploadedLogoPath) {
        await serviceSupabase.storage
          .from(CAFE_LOGO_BUCKET)
          .remove([uploadedLogoPath]);
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    uploadedLogoPath = null;

    return NextResponse.json({
      success: true,
      message: "Shop updated successfully.",
      cafe,
    });
  } catch (error) {
    console.error("Admin shops PATCH error:", error);

    if (uploadedLogoPath) {
      try {
        const serviceSupabase = getServiceClient();
        await serviceSupabase.storage
          .from(CAFE_LOGO_BUCKET)
          .remove([uploadedLogoPath]);
      } catch (rollbackError) {
        console.error(
          "Admin shops PATCH logo rollback error:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update shop.",
      },
      { status: 500 }
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