import { Loader2 } from "lucide-react";

export interface SpinnerProps {
  size?: number;
  className?: string;
}

/** Inline spinning loader (lucide Loader2). */
export function Spinner({ size = 16, className = "" }: SpinnerProps) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}
