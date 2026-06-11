interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, icon, sub, accent }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 ${
        accent
          ? "bg-violet-600 border-violet-500 text-white"
          : "bg-white border-slate-100 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-medium ${
            accent ? "text-violet-200" : "text-slate-500"
          }`}
        >
          {label}
        </span>
        {icon && (
          <span
            className={`text-xl ${accent ? "text-violet-300" : "text-slate-300"}`}
          >
            {icon}
          </span>
        )}
      </div>
      <div>
        <span
          className={`text-3xl font-bold tracking-tight ${
            accent ? "text-white" : "text-slate-900"
          }`}
        >
          {value}
        </span>
        {sub && (
          <p
            className={`text-xs mt-0.5 ${accent ? "text-violet-200" : "text-slate-400"}`}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
