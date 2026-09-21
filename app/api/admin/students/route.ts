import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

type StudentActionBody = {
  studentId?: string;
  action?: "freeze" | "unfreeze";
};

type ServiceSupabaseClient = SupabaseClient;

function getServiceClient(): ServiceSupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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


/* =======================================================
   CURRENT ADMIN CHECK
======================================================= */

async function getCurrentAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      error:
        "You must be logged in.",
      status: 401,
    };
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    return {
      supabase,
      user,
      error:
        profileError.message,
      status: 500,
    };
  }

  if (profile?.role !== "admin") {
    return {
      supabase,
      user,
      error:
        "Only admin can manage students.",
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
   AUTH USER LIST
======================================================= */

async function listAllAuthUsers(
  serviceSupabase: ServiceSupabaseClient
) {
  const users: Array<{
    id: string;
    email?: string;
    user_metadata?: Record<
      string,
      unknown
    >;
  }> = [];

  let page = 1;

  const perPage = 1000;

  while (true) {
    const {
      data,
      error,
    } =
      await serviceSupabase.auth.admin.listUsers(
        {
          page,
          perPage,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    const batch =
      data.users ?? [];

    users.push(
      ...batch.map(
        (user) => ({
          id: user.id,

          email:
            user.email,

          user_metadata:
            (user.user_metadata as Record<
              string,
              unknown
            >) ?? {},
        })
      )
    );

    if (
      batch.length <
      perPage
    ) {
      break;
    }

    page += 1;
  }

  return users;
}


/* =======================================================
   GET STUDENTS
======================================================= */

export async function GET(
  request: Request
) {
  try {
    const auth =
      await getCurrentAdmin();

    if (
      !auth.user ||
      auth.error
    ) {
      return NextResponse.json(
        {
          error:
            auth.error ||
            "Unauthorized.",
        },
        {
          status:
            auth.status,
        }
      );
    }

    const search =
      new URL(request.url)
        .searchParams
        .get("search")
        ?.trim()
        .toLowerCase() ||
      "";

    const serviceSupabase =
      getServiceClient();

    const [
      users,
      profilesResult,
    ] =
      await Promise.all([
        listAllAuthUsers(
          serviceSupabase
        ),

        serviceSupabase
          .from("profiles")
          .select(
            "id, username, full_name, role, is_frozen"
          )
          .eq(
            "role",
            "student"
          ),
      ]);

    if (
      profilesResult.error
    ) {
      return NextResponse.json(
        {
          error:
            profilesResult
              .error
              .message,
        },
        {
          status: 500,
        }
      );
    }

    const profileMap =
      new Map(
        (
          profilesResult
            .data ?? []
        ).map(
          (
            profile
          ) => [
            profile.id,
            profile,
          ]
        )
      );

    const students =
      users
        .filter(
          (user) =>
            profileMap.has(
              user.id
            )
        )
        .map(
          (user) => {
            const profile =
              profileMap.get(
                user.id
              )!;

            return {
              id: user.id,

              username:
                profile.username,

              full_name:
                profile.full_name,

              email:
                user.email ??
                "",

              is_frozen:
                Boolean(
                  profile.is_frozen
                ),
            };
          }
        )
        .filter(
          (student) => {
            if (!search) {
              return true;
            }

            return (
              student
                .username
                ?.toLowerCase()
                .includes(
                  search
                ) ||

              student.email
                .toLowerCase()
                .includes(
                  search
                ) ||

              student
                .full_name
                ?.toLowerCase()
                .includes(
                  search
                )
            );
          }
        )
        .sort(
          (a, b) => {
            const aName =
              a.username ||
              a.full_name ||
              a.email;

            const bName =
              b.username ||
              b.full_name ||
              b.email;

            return aName.localeCompare(
              bName
            );
          }
        );

    return NextResponse.json({
      students,
    });
  } catch (error) {
    console.error(
      "Admin students GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load students.",
      },
      {
        status: 500,
      }
    );
  }
}


/* =======================================================
   FREEZE / UNFREEZE
======================================================= */

export async function PATCH(
  request: Request
) {
  try {
    const auth =
      await getCurrentAdmin();

    if (
      !auth.user ||
      auth.error
    ) {
      return NextResponse.json(
        {
          error:
            auth.error ||
            "Unauthorized.",
        },
        {
          status:
            auth.status,
        }
      );
    }

    const body =
      (await request.json()) as StudentActionBody;

    const studentId =
      body.studentId
        ?.trim() || "";

    const action =
      body.action;

    if (!studentId) {
      return NextResponse.json(
        {
          error:
            "Student ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action !==
        "freeze" &&
      action !==
        "unfreeze"
    ) {
      return NextResponse.json(
        {
          error:
            "Student action must be freeze or unfreeze.",
        },
        {
          status: 400,
        }
      );
    }

    const isFrozen =
      action === "freeze";

    const serviceSupabase =
      getServiceClient();

    /* ---------------------------------------------------
       Auth account ban / unban
    --------------------------------------------------- */

    const {
      error: authError,
    } =
      await serviceSupabase.auth.admin.updateUserById(
        studentId,
        {
          ban_duration:
            isFrozen
              ? "876000h"
              : "none",
        }
      );

    if (authError) {
      return NextResponse.json(
        {
          error:
            authError.message,
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------
       Database freeze state
    --------------------------------------------------- */

    const {
      data,
      error,
    } =
      await auth.supabase.rpc(
        "admin_set_student_frozen",
        {
          p_student_id:
            studentId,

          p_is_frozen:
            isFrozen,
        }
      );

    if (error) {
      /*
       * Roll back the Auth ban if the
       * database update fails.
       */
      await serviceSupabase.auth.admin.updateUserById(
        studentId,
        {
          ban_duration:
            isFrozen
              ? "none"
              : "876000h",
        }
      );

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

      student: data,

      message:
        isFrozen
          ? "Student account frozen successfully."
          : "Student account activated successfully.",
    });
  } catch (error) {
    console.error(
      "Admin students PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to change student account status.",
      },
      {
        status: 500,
      }
    );
  }
}


/* =======================================================
   PERMANENT DELETE
======================================================= */

export async function DELETE(
  request: Request
) {
  try {
    const auth =
      await getCurrentAdmin();

    if (
      !auth.user ||
      auth.error
    ) {
      return NextResponse.json(
        {
          error:
            auth.error ||
            "Unauthorized.",
        },
        {
          status:
            auth.status,
        }
      );
    }

    const studentId =
      new URL(request.url)
        .searchParams
        .get("id")
        ?.trim() || "";

    if (!studentId) {
      return NextResponse.json(
        {
          error:
            "Student ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------
       Delete database records securely
    --------------------------------------------------- */

    const {
      data,
      error,
    } =
      await auth.supabase.rpc(
        "admin_delete_student",
        {
          p_student_id:
            studentId,
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

    /* ---------------------------------------------------
       Delete Supabase Auth user
    --------------------------------------------------- */

    const serviceSupabase =
      getServiceClient();

    const {
      error:
        authDeleteError,
    } =
      await serviceSupabase.auth.admin.deleteUser(
        studentId
      );

    if (
      authDeleteError
    ) {
      return NextResponse.json(
        {
          success: true,

          warning:
            "Student database records were deleted, but the Auth account could not be deleted automatically: " +
            authDeleteError.message,

          student: data,
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Student account and its database records were permanently deleted.",

      student: data,
    });
  } catch (error) {
    console.error(
      "Admin students DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to permanently delete student.",
      },
      {
        status: 500,
      }
    );
  }
}