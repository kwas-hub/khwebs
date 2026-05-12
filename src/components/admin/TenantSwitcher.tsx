import { useTenant } from "@/contexts/TenantContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

export const TenantSwitcher = () => {
  const { tenants, currentTenantId, setCurrentTenantId, loading } = useTenant();
  if (loading || tenants.length === 0) return null;

  const handleChange = (id: string) => {
    setCurrentTenantId(id);
    // Reload so all queries refresh with new tenant context
    window.location.reload();
  };

  if (tenants.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/20 text-xs font-medium text-foreground">
        <Building2 className="w-3.5 h-3.5 text-primary" />
        <span className="truncate max-w-[140px]">{tenants[0].name}</span>
      </div>
    );
  }

  return (
    <Select value={currentTenantId ?? undefined} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-[200px] text-xs">
        <Building2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
        <SelectValue placeholder="Mandant wählen" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map(t => (
          <SelectItem key={t.id} value={t.id}>
            {t.name} {t.role === "admin" && <span className="text-[10px] ml-1 text-primary">(Admin)</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
