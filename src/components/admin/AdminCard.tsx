import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  /** Card title */
  title?: string;
  /** Card subtitle */
  subtitle?: string;
  /** Main content */
  children: ReactNode;
  /** Actions/buttons (top right) */
  actions?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
  /** Padding size */
  padding?: "sm" | "md" | "lg";
  /** Custom className */
  className?: string;
}

/**
 * Standardized card component for admin sections.
 * Follows Wiki.js pattern with optional header and footer.
 */
export const AdminCard = ({
  title,
  subtitle,
  children,
  actions,
  footer,
  padding = "md",
  className,
}: AdminCardProps) => {
  const paddingClass = {
    sm: "p-3",
    md: "p-6",
    lg: "p-8",
  }[padding];

  return (
    <Card className={cn("bg-card border-border shadow-sm", className)}>
      {(title || actions) && (
        <div className={cn(paddingClass, "flex items-center justify-between gap-4 border-b border-border/50")}>
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}

      <div className={paddingClass}>
        {children}
      </div>

      {footer && (
        <div className={cn(paddingClass, "border-t border-border/50 bg-muted/20")}>
          {footer}
        </div>
      )}
    </Card>
  );
};
