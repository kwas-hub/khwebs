import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AdminFieldGroupProps {
  label?: string;
  description?: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

export const AdminFieldGroup = ({
  label,
  description,
  children,
  error,
  required,
  className,
}: AdminFieldGroupProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
};