import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TenantSwitcher = () => {
  const { tenants, currentTenant, setCurrentTenantId } = useTenant();
  const navigate = useNavigate();

  if (!currentTenant || tenants.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 h-9 px-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[150px] truncate">{currentTenant.name}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Mandant wechseln</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => setCurrentTenantId(tenant.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="font-medium">{tenant.name}</span>
              <span className="text-xs text-muted-foreground">{tenant.slug}</span>
            </div>
            {currentTenant.id === tenant.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/admin/tenants")}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" />
          Mandanten verwalten
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
