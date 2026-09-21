"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string;
  description: string | null;
  price: number;
  discount_percentage: number;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
};

type Category = {
  id: string;
  name: string;
};

type ShopkeeperDashboardProps = {
  cafeId: string;
  cafeName: string;
};

export default function ShopkeeperDashboard({
  cafeId,
  cafeName,
}: ShopkeeperDashboardProps) {
  const router = useRouter();
  const supabase = createClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [foods, setFoods] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [foodName, setFoodName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [refundPendingCount, setRefundPendingCount] = useState(0);

  const availableCount = foods.filter((food) => food.is_available).length;
  const soldOutCount = foods.filter((food) => !food.is_available).length;

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data: categoryData, error: categoryError } = await supabase
      .from("menu_categories")
      .select("id, name")
      .eq("cafe_id", cafeId)
      .order("name");

    if (categoryError) {
      setErrorMessage(categoryError.message);
      setLoading(false);
      return;
    }

    setCategories(categoryData ?? []);

    const { data: menuData, error: menuError } = await supabase
      .from("menu_items")
      .select(
        `
        id,
        name,
        category_id,
        description,
        price,
        discount_percentage,
        image_url,
        is_available,
        is_active,
        menu_categories (
          id,
          name
        )
        `
      )
      .eq("cafe_id", cafeId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (menuError) {
      setErrorMessage(menuError.message);
      setLoading(false);
      return;
    }

    const formattedFoods: MenuItem[] = (menuData ?? []).map((item) => {
      const catData = Array.isArray(item.menu_categories)
        ? item.menu_categories[0]
        : item.menu_categories;

      return {
        id: item.id,
        name: item.name,
        category_id: item.category_id,
        category_name: catData?.name ?? "Uncategorized",
        description: item.description,
        price: Number(item.price),
        discount_percentage: Number(item.discount_percentage ?? 0),
        image_url: item.image_url,
        is_available: item.is_available,
        is_active: item.is_active,
      };
    });

    setFoods(formattedFoods);

    const orderResponse = await fetch("/api/shopkeeper/orders", {
      method: "GET",
      cache: "no-store",
    });

    const orderResult = await orderResponse.json().catch(() => null);

    if (!orderResponse.ok) {
      throw new Error(
        orderResult?.error ||
          "Unable to load shopkeeper order data."
      );
    }

    setActiveOrderCount(orderResult?.orders?.length ?? 0);

    const { data: paymentData, error: paymentError } =
      await supabase.rpc("get_pending_refund_payments_v2");

    if (paymentError) {
      setErrorMessage(paymentError.message);
      setLoading(false);
      return;
    }

    setRefundPendingCount(paymentData?.length ?? 0);

    setLoading(false);
  }, [cafeId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function clearForm() {
    setFoodName("");
    setCategory("");
    setPrice("");
    setDiscountPercentage("");
    setDescription("");
    setEditingFoodId(null);
    setSelectedImage(null);

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageChange(file: File | null) {
    setErrorMessage("");

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    if (!file) {
      setSelectedImage(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image size must be 5 MB or less.");
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = foodName.trim();
    const trimmedDescription = description.trim();
    const numericPrice = Number(price);
    const numericDiscount = Number(discountPercentage || 0);

    if (!trimmedName) {
      setErrorMessage("Please enter the food name.");
      return;
    }

    if (!category.trim()) {
      setErrorMessage("Please enter a category.");
      return;
    }

    if (!price.trim() || Number.isNaN(numericPrice)) {
      setErrorMessage("Please enter a valid price.");
      return;
    }

    if (numericPrice < 0) {
      setErrorMessage("Price cannot be negative.");
      return;
    }

    if (Number.isNaN(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) {
      setErrorMessage("Discount must be between 0 and 100%.");
      return;
    }

    setSaving(true);

    try {
      let uploadedImageUrl: string | null = null;

      if (selectedImage) {
        const safeFileName = selectedImage.name
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, "-");

        const uniqueFileName = `${crypto.randomUUID()}-${safeFileName}`;

        const filePath = `${cafeId}/${uniqueFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("food-images")
          .upload(filePath, selectedImage, {
            cacheControl: "3600",
            contentType: selectedImage.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("food-images")
          .getPublicUrl(filePath);

        uploadedImageUrl = publicUrlData.publicUrl;
      }

      if (editingFoodId) {
        const { error } = await supabase.rpc("update_menu_item", {
          p_menu_item_id: editingFoodId,
          p_cafe_id: cafeId,
          p_name: trimmedName,
          p_category_name: category.trim(),
          p_description: trimmedDescription,
          p_price: numericPrice,
          p_image_url: uploadedImageUrl,
          p_discount_percentage: numericDiscount,
        });

        if (error) {
          throw new Error(error.message);
        }

        setSuccessMessage("Food item updated successfully.");
      } else {
        const { error } = await supabase.rpc("create_menu_item", {
          p_cafe_id: cafeId,
          p_name: trimmedName,
          p_category_name: category.trim(),
          p_description: trimmedDescription,
          p_price: numericPrice,
          p_image_url: uploadedImageUrl,
          p_discount_percentage: numericDiscount,
        });

        if (error) {
          throw new Error(error.message);
        }

        setSuccessMessage("Food item added successfully.");
      }

      clearForm();
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(food: MenuItem) {
    setEditingFoodId(food.id);
    setFoodName(food.name);
    setCategory(food.category_name);
    setPrice(String(food.price));
    setDiscountPercentage(String(food.discount_percentage));
    setDescription(food.description ?? "");

    setSelectedImage(null);
    setImagePreview(food.image_url);

    setErrorMessage("");
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleToggleAvailability(food: MenuItem) {
    setErrorMessage("");
    setSuccessMessage("");

    const nextAvailability = !food.is_available;

    const { error } = await supabase.rpc("set_menu_item_availability", {
      p_menu_item_id: food.id,
      p_cafe_id: cafeId,
      p_is_available: nextAvailability,
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(
      nextAvailability
        ? `${food.name} is now Available.`
        : `${food.name} is now marked as Sold Out.`
    );

    await loadData();
  }

  async function handleRemove(food: MenuItem) {
    const confirmed = window.confirm(
      `Remove "${food.name}" from your menu?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("deactivate_menu_item", {
      p_menu_item_id: food.id,
      p_cafe_id: cafeId,
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(`${food.name} was removed from the menu.`);

    if (editingFoodId === food.id) {
      clearForm();
    }

    await loadData();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div>
            <p className="text-lg font-black tracking-tight">
              DIU <span className="text-emerald-600">Smart Cafe</span>
            </p>

            <p className="text-xs text-slate-500">
              Shopkeeper Dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {/* Welcome */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-emerald-600">
            Welcome back
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            {cafeName}
          </h1>

          <p className="mt-2 text-slate-500">
            Manage your real cafe menu from one place.
          </p>
        </div>

        {/* Messages */}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total active foods
            </p>

            <p className="mt-2 text-3xl font-black text-slate-950">
              {foods.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Available
            </p>

            <p className="mt-2 text-3xl font-black text-emerald-600">
              {availableCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Sold out
            </p>

            <p className="mt-2 text-3xl font-black text-red-500">
              {soldOutCount}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/shopkeeper/orders")}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">
              Active Orders
            </p>

            <p className="mt-2 text-3xl font-black text-blue-600">
              {activeOrderCount}
            </p>

            <p className="mt-2 text-xs font-semibold text-blue-600">
              Open Order Management →
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/shopkeeper/payments")}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">
              Refund Pending
            </p>

            <p className="mt-2 text-3xl font-black text-orange-600">
              {refundPendingCount}
            </p>

            <p className="mt-2 text-xs font-semibold text-orange-600">
              Open Refund Management →
            </p>
          </button>
        </section>

        {/* Shopkeeper Management Shortcuts */}
        <section className="mt-8 grid gap-5 md:grid-cols-2">

          {/* Refund Management */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
              Payments
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Refund Management
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Cancelled order-এর advance payment refund manage করুন।
            </p>

            <button
              onClick={() => router.push("/shopkeeper/payments")}
              className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Open Refund Management
            </button>
          </div>

          {/* Order Management */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
              Orders
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Order Management
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Confirmed, preparing এবং ready orders manage করুন।
            </p>

            <button
              onClick={() => router.push("/shopkeeper/orders")}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
            >
              Open Order Management
            </button>
          </div>

        </section>

        {/* Add / Edit Form */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                {editingFoodId ? "Edit menu item" : "Menu management"}
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {editingFoodId
                  ? "Update food item"
                  : "Add new food item"}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Changes are saved directly to the DIU Smart Cafe database.
              </p>
            </div>

            {editingFoodId && (
              <button
                onClick={clearForm}
                className="w-fit rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">

            {/* Food Name */}
            <div>
              <label
                htmlFor="foodName"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Food Name
              </label>

              <input
                id="foodName"
                type="text"
                value={foodName}
                onChange={(event) => setFoodName(event.target.value)}
                placeholder="e.g. Chicken Biryani"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Category
              </label>

              <input
                id="category"
                list="category-options"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. Lunch"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              <datalist id="category-options">
                {categories.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}

                <option value="Lunch" />
                <option value="Fast Food" />
                <option value="Snacks" />
                <option value="Drinks" />
                <option value="Dessert" />
              </datalist>
            </div>

            {/* Price */}
            <div>
              <label
                htmlFor="price"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Price (৳)
              </label>

              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="e.g. 120"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {/* Discount */}
            <div>
              <label
                htmlFor="discountPercentage"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Discount (%)
              </label>

              <input
                id="discountPercentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercentage}
                onChange={(event) =>
                  setDiscountPercentage(event.target.value)
                }
                placeholder="e.g. 10"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              <p className="mt-2 text-xs text-slate-400">
                Enter 0 if there is no discount. Maximum 100%.
              </p>
            </div>

            {/* Food Image Input */}
            <div>
              <label
                htmlFor="foodImage"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Food Image
              </label>

              <input
                ref={fileInputRef}
                id="foodImage"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  handleImageChange(file);
                }}
                className="block w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-500 file:mr-4 file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-slate-700"
              />

              <p className="mt-2 text-xs text-slate-400">
                JPG, PNG or WebP. Maximum 5 MB.
              </p>

              {imagePreview && (
                <div className="mt-4">
                  <img
                    src={imagePreview}
                    alt="Food preview"
                    className="h-28 w-28 rounded-xl border border-slate-200 object-cover"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Description
              </label>

              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Write a short description of this food..."
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingFoodId
                ? "Update Food"
                : "+ Add Food"}
            </button>
          </div>
        </section>

        {/* Current Menu */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">

            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                Live database menu
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Your food items
              </h2>
            </div>

            <p className="text-sm text-slate-500">
              {foods.length} items
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading menu...
              </div>
            ) : foods.length === 0 ? (
              <div className="p-10 text-center">

                <p className="text-lg font-bold text-slate-900">
                  No food items yet
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Add your first food item using the form above.
                </p>

              </div>
            ) : (
              <>
                <div className="hidden border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-[1.8fr_1fr_1fr_0.8fr_1fr_1.2fr] md:gap-4">
                  <span>Food</span>
                  <span>Category</span>
                  <span>Price</span>
                  <span>Discount</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>

                <div className="divide-y divide-slate-200">

                  {foods.map((food) => (
                    <div
                      key={food.id}
                      className="grid gap-4 px-5 py-5 md:grid-cols-[1.8fr_1fr_1fr_0.8fr_1fr_1.2fr] md:items-center"
                    >

                      {/* Food */}
                      <div className="flex items-center gap-4">

                        {food.image_url ? (
                          <img
                            src={food.image_url}
                            alt={food.name}
                            className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-lg">
                            🍽️
                          </div>
                        )}

                        <div>
                          <p className="font-extrabold text-slate-950">
                            {food.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {food.description ||
                              "No description provided."}
                          </p>
                        </div>
                      </div>

                      {/* Category */}
                      <div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {food.category_name}
                        </span>
                      </div>

                      {/* Price */}
                      <div>
                        {food.discount_percentage > 0 ? (
                          <div>
                            <div className="text-xs text-slate-400 line-through">
                              ৳{food.price.toFixed(2)}
                            </div>
                            <div className="font-bold text-slate-950">
                              ৳{(food.price * (100 - food.discount_percentage) / 100).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <div className="font-bold text-slate-950">
                            ৳{food.price.toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Discount */}
                      <div>
                        {food.discount_percentage > 0 ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            {food.discount_percentage}% OFF
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No discount
                          </span>
                        )}
                      </div>

                      {/* Availability */}
                      <div>
                        <button
                          onClick={() =>
                            handleToggleAvailability(food)
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                            food.is_available
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                        >
                          {food.is_available
                            ? "Available"
                            : "Sold Out"}
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleEdit(food)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleRemove(food)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>

                    </div>
                  ))}

                </div>
              </>
            )}

          </div>
        </section>

      </div>
    </main>
  );
}