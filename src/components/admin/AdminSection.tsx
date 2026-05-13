import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminSectionProps {
  /** Section content */
  children: ReactNode;
  /** Vertical spacing between sections */
  spacing?: "sm" | "md" | "lg";
  /** Custom className */
  className?: string;
}

/**
 * Wrapper component for consistent spacing between sections.
 * Use to ensure uniform gaps between major content areas.
 */
export const AdminSection = ({
  children,
  spacing = "md",
  className,
}: AdminSectionProps) => {
  const spacingClass = {
    sm: "space-y-3",
    md: "space-y-6",
    lg: "space-y-8",
  }[spacing];

  return (
    <div className={cn(spacingClass, className)}>
      {children}
    </div>
  );
};
