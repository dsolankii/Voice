interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "purple";
}

export function Badge({ label, variant = "default" }: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    error: "bg-red-50 text-red-700 ring-1 ring-red-200",
    info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant]}`}
    >
      {label}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> =
    {
      draft: { label: "Draft", variant: "default" },
      active: { label: "Active", variant: "success" },
      paused: { label: "Paused", variant: "warning" },
      completed: { label: "Completed", variant: "info" },
      pending: { label: "Pending", variant: "default" },
      transcript_ready: { label: "Transcript Ready", variant: "warning" },
      processing: { label: "Processing", variant: "info" },
      failed: { label: "Failed", variant: "error" },
    };

  const config = map[status] ?? { label: status, variant: "default" as const };
  return <Badge label={config.label} variant={config.variant} />;
}

export function sentimentBadge(sentiment?: string) {
  if (!sentiment) return null;
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> =
    {
      positive: { label: "Positive", variant: "success" },
      neutral: { label: "Neutral", variant: "default" },
      negative: { label: "Negative", variant: "error" },
      mixed: { label: "Mixed", variant: "warning" },
    };

  const config = map[sentiment] ?? {
    label: sentiment,
    variant: "default" as const,
  };
  return <Badge label={config.label} variant={config.variant} />;
}
