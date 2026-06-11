import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

export function Card({
  children,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  const paddings = { sm: "p-4", md: "p-5", lg: "p-6" };
  return (
    <div
      className={`bg-white border border-slate-100 rounded-xl shadow-sm ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
