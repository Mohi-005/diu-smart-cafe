import Link from "next/link";

type FoodCardProps = {
  id: string;
  name: string;
  category: string;
  price: number;
  cafe: string;
  cafeId: string;
  available: boolean;
  imageUrl: string | null;
  discountPercentage: number;
};

export default function FoodCard({
  id,
  name,
  category,
  price,
  cafe,
  cafeId,
  available,
  imageUrl,
  discountPercentage,
}: FoodCardProps) {
  const discount = Math.max(
    0,
    Math.min(100, discountPercentage)
  );

  const finalPrice =
    discount > 0
      ? price * (1 - discount / 100)
      : price;

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-emerald-200 hover:shadow-xl">
      {/* Food Image */}
      <div className="relative h-48 overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-6xl">
            🍽️
          </div>
        )}

        {/* Availability */}
        <span
          className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${
            available
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {available ? "Available" : "Sold Out"}
        </span>

        {/* Discount */}
        {discount > 0 && (
          <span className="absolute left-4 top-4 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            {discount}% OFF
          </span>
        )}
      </div>

      {/* Food Details */}
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
          {category}
        </p>

        <h3 className="mt-1 line-clamp-1 text-lg font-extrabold tracking-tight text-slate-950">
          {name}
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          {cafe}
        </p>

        {/* Price + Action */}
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            {discount > 0 && (
              <p className="text-sm font-semibold text-slate-400 line-through">
                ৳{price.toFixed(2)}
              </p>
            )}

            <p className="text-xl font-black text-slate-950">
              ৳{finalPrice.toFixed(2)}
            </p>
          </div>

          {available ? (
            <Link
              href={`/menu?cafe=${encodeURIComponent(cafeId)}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition duration-200 hover:bg-emerald-700"
            >
              Pre-Order

              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-400">
              Unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}