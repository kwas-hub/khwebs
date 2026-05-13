import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminContentWrapperProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
}

export const AdminContentWrapper = ({
  children,
  maxWidth = "xl",
  className,
}: AdminContentWrapperProps) => {
  const maxWidthClass = {
    sm: "max-w-screen-sm",
    md: "max-w-screen-md",
    lg: "max-w-screen-lg",
    xl: "max-w-screen-xl",
    "2xl": "max-w-screen-2xl",
    full: "max-w-full",
  }[maxWidth];

  return (
    <div className={cn("mx-auto w-full", maxWidthClass, className)}>
      {children}
    </div>
  );
};