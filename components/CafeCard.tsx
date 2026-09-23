import Link from "next/link";

type CafeCardProps = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  logoUrl: string | null;
};

export default function CafeCard({
  id,
  name,
  description,
  location,
  logoUrl,
}: CafeCardProps) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-emerald-200 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        {/* Cafe Logo */}
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-3xl transition duration-300 group-hover:bg-emerald-50">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${name} logo`}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <span aria-hidden="true">🍽️</span>
          )}
        </div>

        {/* Status */}
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          Open
        </span>
      </div>

      {/* Cafe Information */}
      <div className="mt-6">
        <h3 className="text-lg font-extrabold tracking-tight text-slate-950">
          {name}
        </h3>

        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
          {description || "Browse this cafe's available food menu."}
        </p>

        {location && (
          <p className="mt-3 text-xs font-semibold text-slate-400">
            📍 {location}
          </p>
        )}
      </div>

      {/* Action */}
      <Link
        href={`/menu?cafe=${encodeURIComponent(id)}`}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-800 transition duration-200 hover:bg-slate-900 hover:text-white"
      >
        View Menu

        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      </Link>
    </article>
  );
}