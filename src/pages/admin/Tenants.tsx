import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Building2, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Member = { user_id: string; role: string; email: string | null; display_name: string | null };

const TenantsPage = () => {
  const { userId, isAdmin } = useAuth();
  const { currentTenant, isTenantAdmin, reload, tenants, setCurrentTenantId } = useTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");

  useEffect(() => {
    if (currentTenant) {
      setEditName(currentTenant.name);
      setEditSlug(currentTenant.slug);
      loadMembers(currentTenant.id);
    }
  }, [currentTenant?.id]);

  const loadMembers = async (tid: string) => {
    const { data: ut } = await supabase.from("user_tenants").select("user_id, role").eq("tenant_id", tid);
    if (!ut) { setMembers([]); return; }
    const ids = ut.map(u => u.user_id);
    if (ids.length === 0) { setMembers([]); return; }
    const { data: profs } = await supabase.from("profiles").select("user_id, email, display_name").in("user_id", ids);
    setMembers(ut.map(u => {
      const p = profs?.find(p => p.user_id === u.user_id);
      return { user_id: u.user_id, role: u.role, email: p?.email ?? null, display_name: p?.display_name ?? null };
    }));
  };

  const createTenant = async () => {
    if (!name.trim() || !slug.trim()) return toast.error("Name und Slug erforderlich");
    if (!userId) return toast.error("Nicht eingeloggt");
    
    setCreating(true);
    
    // 1. Mandanten erstellen
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({ name: name.trim(), slug: slug.trim().toLowerCase() })
      .select()
      .single();
    
    if (tenantError) {
      setCreating(false);
      return toast.error(tenantError.message);
    }
    
    // 2. Aktuellen Benutzer als Admin zum Mandanten hinzufügen
    const { error: memberError } = await supabase
      .from("user_tenants")
      .insert({ 
        user_id: userId, 
        tenant_id: tenant.id, 
        role: "admin" 
      });
    
    setCreating(false);
    
    if (memberError) {
      toast.error("Mandant angelegt, aber du wurdest nicht als Mitglied hinzugefügt.");
    } else {
      toast.success("Mandant angelegt und du wurdest als Admin hinzugefügt");
    }
    
    setName("");
    setSlug("");
    await reload();
    
    // Zum neuen Mandanten wechseln (wenn erfolgreich)
    if (tenant && !memberError) {
      setCurrentTenantId(tenant.id);
    }
  };

  const saveTenant = async () => {
    if (!currentTenant) return;
    const { error } = await supabase.from("tenants").update({ name: editName, slug: editSlug }).eq("id", currentTenant.id);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    await reload();
  };

  const deleteTenant = async () => {
    if (!currentTenant) return;
    if (!confirm(`Mandant "${currentTenant.name}" wirklich löschen? Alle zugeordneten Daten werden ebenfalls entfernt.`)) return;
    const { error } = await supabase.from("tenants").delete().eq("id", currentTenant.id);
    if (error) return toast.error(error.message);
    toast.success("Mandant gelöscht");
    localStorage.removeItem("active-tenant-id");
    window.location.reload();
  };

  const inviteMember = async () => {
    if (!currentTenant || !inviteEmail.trim()) return;
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("email", inviteEmail.trim().toLowerCase()).maybeSingle();
    if (!prof) return toast.error("Benutzer mit dieser E-Mail nicht gefunden. Er muss sich zuerst registrieren.");
    const { error } = await supabase.from("user_tenants").insert({ user_id: prof.user_id, tenant_id: currentTenant.id, role: inviteRole });
    if (error) return toast.error(error.message);
    toast.success("Mitglied hinzugefügt");
    setInviteEmail("");
    loadMembers(currentTenant.id);
  };

  const removeMember = async (uid: string) => {
    if (!currentTenant) return;
    if (!confirm("Mitglied entfernen?")) return;
    const { error } = await supabase.from("user_tenants").delete().eq("user_id", uid).eq("tenant_id", currentTenant.id);
    if (error) return toast.error(error.message);
    loadMembers(currentTenant.id);
  };

  const changeRole = async (uid: string, role: string) => {
    if (!currentTenant) return;
    const { error } = await supabase.from("user_tenants").update({ role }).eq("user_id", uid).eq("tenant_id", currentTenant.id);
    if (error) return toast.error(error.message);
    loadMembers(currentTenant.id);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Building2 className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Mandanten-Verwaltung</h1>
        </div>

        {currentTenant && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aktueller Mandant</h2>
              <Badge variant={isTenantAdmin ? "default" : "secondary"}>
                {isTenantAdmin ? "Admin" : "Member"}
              </Badge>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} disabled={!isTenantAdmin} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={editSlug} onChange={e => setEditSlug(e.target.value)} disabled={!isTenantAdmin} />
              </div>
            </div>
            {isTenantAdmin && (
              <div className="flex gap-2">
                <Button onClick={saveTenant}>Speichern</Button>
                <Button variant="destructive" onClick={deleteTenant}>
                  <Trash2 className="w-4 h-4 mr-1" />Löschen
                </Button>
              </div>
            )}
          </Card>
        )}

        {currentTenant && isTenantAdmin && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserPlus className="w-5 h-5" />Mitglieder
            </h2>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>E-Mail</Label>
                <Input 
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                  placeholder="benutzer@example.com" 
                />
              </div>
              <div>
                <Label>Rolle</Label>
                <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={inviteMember}>
                <Plus className="w-4 h-4 mr-1" />Hinzufügen
              </Button>
            </div>
            <div className="divide-y border-t">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{m.display_name || m.email || m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={v => changeRole(m.user_id, v)}>
                      <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="py-4 text-sm text-muted-foreground text-center">Keine Mitglieder</div>
              )}
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Neuen Mandanten anlegen</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Acme GmbH" />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="acme" />
              </div>
            </div>
            <Button onClick={createTenant} disabled={creating}>
              <Plus className="w-4 h-4 mr-1" />Anlegen
            </Button>
            <p className="text-xs text-muted-foreground">
              Du wirst automatisch als Admin hinzugefügt und zum neuen Mandanten gewechselt.
            </p>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Meine Mandanten</h2>
          <div className="space-y-2">
            {tenants.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground text-center">Keine Mandanten zugeordnet</div>
            ) : (
              tenants.map(t => (
                <div 
                  key={t.id} 
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    currentTenant?.id === t.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setCurrentTenantId(t.id)}
                >
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.slug}</div>
                  </div>
                  <Badge variant={t.role === "admin" ? "default" : "secondary"}>{t.role}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default TenantsPage;
