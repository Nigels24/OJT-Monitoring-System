import { ButtonHTMLAttributes, ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: LucideIcon;
  iconSize?: number;
  variant?: "primary" | "secondary";
  loading?: boolean;
}

export default function Button({
  children,
  icon: Icon,
  iconSize = 18,
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "w-full h-12 flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors disabled:opacity-60";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={iconSize} />}
      {loading ? "Loading..." : children}
    </button>
  );
}
