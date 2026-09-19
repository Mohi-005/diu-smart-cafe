import Link from "next/link";

type CafeCardProps = {
  name: string;
  description: string;
  crowd: string;
  color: string;
};

export default function CafeCard({
  name,
  description,
  crowd,
  color,
}: CafeCardProps) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-emerald-200 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        {/* Cafe Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl transition duration-300 group-hover:bg-emerald-50 group-hover:scale-105">
          🍽️
        </div>

        {/* Crowd Status */}
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}
        >
          {crowd} crowd
        </span>
      </div>

      {/* Cafe Information */}
      <div className="mt-6">
        <h3 className="text-lg font-extrabold tracking-tight text-slate-950">
          {name}
        </h3>

        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>

      {/* Action */}
      <Link
        href="/menu"
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