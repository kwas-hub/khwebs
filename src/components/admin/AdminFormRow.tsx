import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminFormRowProps {
  /** Form fields/content */
  children: ReactNode;
  /** Number of columns (1-4) */
  columns?: 1 | 2 | 3 | 4;
  /** Gap between columns */
  gap?: "sm" | "md" | "lg";
  /** Custom className */
  className?: string;
}

/**
 * Responsive grid wrapper for form fields.
 * Automatically stacks on mobile, expands on larger screens.
 * 
 * Usage:
 * ```tsx
 * <AdminFormRow columns={2} gap="md">
 *   <AdminFieldGroup><Input /></AdminFieldGroup>
 *   <AdminFieldGroup><Input /></AdminFieldGroup>
 * </AdminFormRow>
 * ```
 */
export const AdminFormRow = ({
  children,
  columns = 1,
  gap = "md",
  className,
}: AdminFormRowProps) => {
  const columnClass = {
    1: "grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }[columns];

  const gapClass = {
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6",
  }[gap];

  return (
    <div className={cn("grid", columnClass, gapClass, className)}>
      {children}
    </div>
  );
};
