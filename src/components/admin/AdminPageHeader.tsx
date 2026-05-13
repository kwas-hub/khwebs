import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface AdminPageHeaderProps {
  /** Icon component (from lucide-react) */
  icon?: LucideIcon;
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  description?: string;
  /** Optional action buttons/components (right-aligned) */
  actions?: ReactNode;
  /** Custom icon color */
  iconColor?: string;
}

/**
 * Unified page header for all admin pages.
 * Follows Wiki.js design pattern: Icon + Title + Description + Actions
 */
export const AdminPageHeader = ({
  icon: Icon,
  title,
  description,
  actions,
  iconColor = "text-primary",
}: AdminPageHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`p-2 rounded-lg bg-primary/10 flex-shrink-0`}>
            <Icon className={`h-7 w-7 ${iconColor}`} />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold leading-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};
