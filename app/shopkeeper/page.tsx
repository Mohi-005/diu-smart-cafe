import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShopkeeperDashboard from "./ShopkeeperDashboard";

export default async function ShopkeeperPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "shopkeeper") {
    redirect("/");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("cafe_staff")
    .select(
      `
      cafe_id,
      cafes (
        id,
        name
      )
      `
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (assignmentError || !assignment?.cafes) {
    redirect("/");
  }

  const cafe = Array.isArray(assignment.cafes)
    ? assignment.cafes[0]
    : assignment.cafes;

  if (!cafe) {
    redirect("/");
  }

  return (
    <ShopkeeperDashboard
      cafeId={cafe.id}
      cafeName={cafe.name}
    />
  );
}