import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronDown, Plus, Settings, Shield, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TenantSwitcher = () => {
  const { tenants, currentTenant, setCurrentTenantId, isTenantAdmin } = useTenant();
  const navigate = useNavigate();

  if (!currentTenant || tenants.length === 0) return null;

  const adminTenants = tenants.filter(t => t.role === "admin");
  const memberTenants = tenants.filter(t => t.role === "member");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 h-9 px-3 hover:bg-accent/50 transition-colors"
        >
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[150px] truncate font-medium">{currentTenant.name}</span>
          {isTenantAdmin && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
              Admin
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>Mandant wechseln</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Admin Mandanten */}
        {adminTenants.length > 0 && (
          <>
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Administratoren
              </span>
            </div>
            {adminTenants.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => setCurrentTenantId(tenant.id)}
                className="flex items-center justify-between cursor-pointer py-2.5"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tenant.name}</span>
                    {tenant.id === currentTenant.id && (
                      <Badge variant="default" className="text-[9px] px-1 py-0 h-4">
                        Aktiv
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{tenant.slug}</span>
                </div>
                {currentTenant.id === tenant.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Member Mandanten */}
        {memberTenants.length > 0 && adminTenants.length > 0 && <DropdownMenuSeparator />}
        
        {memberTenants.length > 0 && (
          <>
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Mitgliedschaften
              </span>
            </div>
            {memberTenants.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => setCurrentTenantId(tenant.id)}
                className="flex items-center justify-between cursor-pointer py-2.5"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tenant.name}</span>
                    {tenant.id === currentTenant.id && (
                      <Badge variant="default" className="text-[9px] px-1 py-0 h-4">
                        Aktiv
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{tenant.slug}</span>
                </div>
                {currentTenant.id === tenant.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {tenants.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Keine Mandanten zugewiesen
          </div>
        )}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => navigate("/admin/tenants")}
          className="cursor-pointer py-2.5"
        >
          <Plus className="h-4 w-4 mr-2" />
          <span>Mandanten verwalten</span>
          <DropdownMenuShortcut>
            <Settings className="h-3 w-3" />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};