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
  const { tenants, currentTenant, setCurrentTenantId, isTenantAdmin, loading } = useTenant();
  const navigate = useNavigate();

  // DEBUG: Console Ausgaben
  console.log("TenantSwitcher - tenants:", tenants);
  console.log("TenantSwitcher - currentTenant:", currentTenant);
  console.log("TenantSwitcher - loading:", loading);

  // Wenn noch geladen wird, zeige einen Lade-Indikator
  if (loading) {
    return (
      <Button variant="outline" className="flex items-center gap-2 h-9 px-3">
        <Building2 className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span className="text-muted-foreground">Laden...</span>
      </Button>
    );
  }

  // Wenn keine Mandanten vorhanden sind, zeige nichts
  if (tenants.length === 0) {
    console.log("Keine Mandanten, rendere nichts");
    return null;
  }

  console.log("Rendere TenantSwitcher mit", tenants.length, "Mandanten");

  const adminTenants = tenants.filter(t => t.role === "admin");
  const memberTenants = tenants.filter(t => t.role === "member");

  // BUTTON: Zeige entweder aktuellen Mandanten oder "Mandant wählen"
  const getButtonText = () => {
    if (currentTenant) {
      return currentTenant.name;
    }
    return "Mandant wählen";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 h-9 px-3 hover:bg-accent/50 transition-colors"
        >
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[150px] truncate font-medium">{getButtonText()}</span>
          {currentTenant && isTenantAdmin && (
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
          <span>Mandant wählen</span>
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
                onClick={() => {
                  console.log("Wechsle zu:", tenant.name);
                  setCurrentTenantId(tenant.id);
                }}
                className="flex items-center justify-between cursor-pointer py-2.5"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tenant.name}</span>
                    {currentTenant?.id === tenant.id && (
                      <Badge variant="default" className="text-[9px] px-1 py-0 h-4">
                        Aktiv
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{tenant.slug}</span>
                </div>
                {currentTenant?.id === tenant.id && (
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
                onClick={() => {
                  console.log("Wechsle zu:", tenant.name);
                  setCurrentTenantId(tenant.id);
                }}
                className="flex items-center justify-between cursor-pointer py-2.5"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tenant.name}</span>
                    {currentTenant?.id === tenant.id && (
                      <Badge variant="default" className="text-[9px] px-1 py-0 h-4">
                        Aktiv
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{tenant.slug}</span>
                </div>
                {currentTenant?.id === tenant.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </>
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
