import { cn } from "@/lib/utils";

interface AdminDividerProps {
  spacing?: "sm" | "md" | "lg";
  className?: string;
}

export const AdminDivider = ({
  spacing = "md",
  className,
}: AdminDividerProps) => {
  const spacingClass = {
    sm: "my-4",
    md: "my-8",
    lg: "my-12",
  }[spacing];

  return <hr className={cn("border-border/50", spacingClass, className)} />;
};