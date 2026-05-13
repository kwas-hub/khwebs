import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Building2, UserPlus, Users, Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminPageHeader,
  AdminCard,
  AdminSection,
  AdminContentWrapper,
  AdminFormRow,
  AdminFieldGroup,
  AdminDivider,
} from "@/components/admin";

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
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      setEditName(currentTenant.name);
      setEditSlug(currentTenant.slug);
      loadMembers(currentTenant.id);
    }
  }, [currentTenant?.id]);

  const loadMembers = async (tid: string) => {
    setLoadingMembers(true);
    const { data: ut } = await supabase.from("user_tenants").select("user_id, role").eq("tenant_id", tid);
    if (!ut) { 
      setMembers([]); 
      setLoadingMembers(false);
      return; 
    }
    const ids = ut.map(u => u.user_id);
    if (ids.length === 0) { 
      setMembers([]); 
      setLoadingMembers(false);
      return; 
    }
    const { data: profs } = await supabase.from("profiles").select("user_id, email, display_name").in("user_id", ids);
    setMembers(ut.map(u => {
      const p = profs?.find(p => p.user_id === u.user_id);
      return { user_id: u.user_id, role: u.role, email: p?.email ?? null, display_name: p?.display_name ?? null };
    }));
    setLoadingMembers(false);
  };

  const createTenant = async () => {
    if (!name.trim() || !slug.trim()) return toast.error("Name und Slug erforderlich");
    if (!userId) return toast.error("Nicht eingeloggt");
    
    setCreating(true);
    
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({ name: name.trim(), slug: slug.trim().toLowerCase() })
      .select()
      .single();
    
    if (tenantError) {
      setCreating(false);
      return toast.error(tenantError.message);
    }
    
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
    
    if (tenant && !memberError) {
      setCurrentTenantId(tenant.id);
    }
  };

  const saveTenant = async () => {
    if (!currentTenant) return;
    setSaving(true);
    const { error } = await supabase.from("tenants").update({ name: editName, slug: editSlug }).eq("id", currentTenant.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Mandant gespeichert");
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
    
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", inviteEmail.trim().toLowerCase())
      .maybeSingle();
      
    if (!prof) return toast.error("Benutzer mit dieser E-Mail nicht gefunden. Er muss sich zuerst registrieren.");
    
    const { error } = await supabase
      .from("user_tenants")
      .insert({ user_id: prof.user_id, tenant_id: currentTenant.id, role: inviteRole });
      
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
    toast.success("Mitglied entfernt");
    loadMembers(currentTenant.id);
  };

  const changeRole = async (uid: string, role: string) => {
    if (!currentTenant) return;
    const { error } = await supabase.from("user_tenants").update({ role }).eq("user_id", uid).eq("tenant_id", currentTenant.id);
    if (error) return toast.error(error.message);
    loadMembers(currentTenant.id);
  };

  const adminCount = members.filter(m => m.role === "admin").length;
  const memberCount = members.filter(m => m.role === "member").length;

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="xl">
        <AdminPageHeader 
          icon={Building2} 
          title="Mandanten-Verwaltung" 
          description="Verwalte Mandanten, Mitglieder und Berechtigungen"
          badge={`${tenants.length} Mandant(en)`}
        />

        {/* Aktueller Mandant */}
        {currentTenant && (
          <AdminSection spacing="lg">
            <AdminCard 
              title="Aktueller Mandant"
              description="Einstellungen für den aktuell ausgewählten Mandanten"
              actions={
                <Badge variant={isTenantAdmin ? "default" : "secondary"} className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {isTenantAdmin ? "Administrator" : "Mitglied"}
                </Badge>
              }
            >
              <div className="space-y-4">
                <AdminFormRow columns={2}>
                  <AdminFieldGroup label="Name" required>
                    <Input 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      disabled={!isTenantAdmin}
                      placeholder="z.B. Acme GmbH"
                    />
                  </AdminFieldGroup>
                  <AdminFieldGroup label="Slug" required>
                    <Input 
                      value={editSlug} 
                      onChange={e => setEditSlug(e.target.value)} 
                      disabled={!isTenantAdmin}
                      placeholder="acme"
                    />
                  </AdminFieldGroup>
                </AdminFormRow>
                
                {isTenantAdmin && (
                  <div className="flex gap-2 pt-2">
                    <Button onClick={saveTenant} disabled={saving}>
                      {saving ? "Wird gespeichert..." : "Speichern"}
                    </Button>
                    <Button variant="destructive" onClick={deleteTenant}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Mandant löschen
                    </Button>
                  </div>
                )}
              </div>
            </AdminCard>
          </AdminSection>
        )}

        {/* Mitglieder (nur für Tenant-Admins sichtbar) */}
        {currentTenant && isTenantAdmin && (
          <AdminSection spacing="lg">
            <AdminCard 
              title="Mitglieder"
              description={`Verwalte die Mitglieder dieses Mandanten (${memberCount} Mitglieder, ${adminCount} Administratoren)`}
              icon={<Users className="h-4 w-4" />}
            >
              <div className="space-y-4">
                {/* Einladungs-Formular */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">E-Mail einladen</Label>
                    <Input 
                      value={inviteEmail} 
                      onChange={e => setInviteEmail(e.target.value)} 
                      placeholder="benutzer@example.com" 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Rolle</Label>
                    <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                      <SelectTrigger className="w-[140px] mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">👤 Mitglied</SelectItem>
                        <SelectItem value="admin">👑 Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={inviteMember} className="mb-0.5">
                    <UserPlus className="w-4 h-4 mr-1" />
                    Einladen
                  </Button>
                </div>

                <AdminDivider spacing="sm" />

                {/* Mitglieder-Liste */}
                {loadingMembers ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
                    Lade Mitglieder...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map(member => (
                      <div 
                        key={member.user_id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {member.display_name || member.email || member.user_id.slice(0, 8)}
                            </span>
                            {member.user_id === userId && (
                              <Badge variant="outline" className="text-[9px]">Das bist du</Badge>
                            )}
                          </div>
                          {member.email && (
                            <div className="text-xs text-muted-foreground mt-0.5">{member.email}</div>
                          )}
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            ID: {member.user_id.slice(0, 8)}...
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select 
                            value={member.role} 
                            onValueChange={v => changeRole(member.user_id, v)}
                            disabled={member.user_id === userId && member.role === "admin" && adminCount === 1}
                          >
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">👤 Mitglied</SelectItem>
                              <SelectItem value="admin">👑 Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          {member.user_id !== userId && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeMember(member.user_id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {members.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Keine Mitglieder vorhanden</p>
                        <p className="text-xs mt-1">Lade Benutzer per E-Mail ein, um sie hinzuzufügen.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AdminCard>
          </AdminSection>
        )}

        {/* Neuen Mandanten anlegen (nur für Super-Admins) */}
        {isAdmin && (
          <AdminSection spacing="lg">
            <AdminCard 
              title="Neuen Mandanten anlegen"
              description="Erstelle einen neuen unabhängigen Mandanten"
              icon={<Building2 className="h-4 w-4" />}
            >
              <div className="space-y-4">
                <AdminFormRow columns={2}>
                  <AdminFieldGroup label="Name" required>
                    <Input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      placeholder="z. B. Acme GmbH" 
                    />
                  </AdminFieldGroup>
                  <AdminFieldGroup label="Slug" required>
                    <Input 
                      value={slug} 
                      onChange={e => setSlug(e.target.value)} 
                      placeholder="acme" 
                    />
                  </AdminFieldGroup>
                </AdminFormRow>
                
                <div className="bg-muted/30 rounded-lg p-3 border">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Hinweis:</p>
                      <p>Du wirst automatisch als Administrator hinzugefügt und nach der Erstellung zu diesem Mandanten gewechselt.</p>
                    </div>
                  </div>
                </div>
                
                <Button onClick={createTenant} disabled={creating}>
                  {creating ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Wird erstellt...
                    </div>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Mandant anlegen
                    </>
                  )}
                </Button>
              </div>
            </AdminCard>
          </AdminSection>
        )}

        {/* Meine Mandanten (Übersicht) */}
        <AdminSection spacing="lg">
          <AdminCard 
            title="Meine Mandanten"
            description="Wechsle zwischen deinen zugewiesenen Mandanten"
            icon={<Building2 className="h-4 w-4" />}
          >
            {tenants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Keine Mandanten zugeordnet</p>
                {isAdmin && (
                  <p className="text-xs mt-1">Erstelle oben einen neuen Mandanten, um zu beginnen.</p>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {tenants.map(tenant => (
                  <div 
                    key={tenant.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      currentTenant?.id === tenant.id 
                        ? 'bg-primary/5 border-primary shadow-sm' 
                        : 'bg-card border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                    onClick={() => setCurrentTenantId(tenant.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{tenant.name}</span>
                        {currentTenant?.id === tenant.id && (
                          <Badge variant="default" className="text-[9px] flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Aktuell
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {tenant.slug}
                      </div>
                    </div>
                    <Badge variant={tenant.role === "admin" ? "default" : "secondary"} className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {tenant.role === "admin" ? "Administrator" : "Mitglied"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </AdminSection>

        {/* Hinweis für Super-Admins */}
        {isAdmin && !currentTenant && tenants.length === 0 && (
          <AdminSection spacing="lg">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <Building2 className="h-8 w-8 mx-auto mb-2 text-primary opacity-50" />
              <p className="text-sm text-muted-foreground">
                Willkommen! Erstelle deinen ersten Mandanten, um loszulegen.
              </p>
            </div>
          </AdminSection>
        )}
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default TenantsPage;