import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Users as UsersIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { AdminPageHeader, AdminCard, AdminSection, AdminContentWrapper } from "@/components/admin";

type Profile = {
  id: string; user_id: string; email: string; display_name: string;
  status: "new" | "active" | "blocked"; created_at: string;
};
type Role = "admin" | "editor" | "guest";

const ROLES: Role[] = ["admin", "editor", "guest"];
const ROLE_LABELS: Record<Role, string> = { admin: "Administrator", editor: "Editor", guest: "Gast" };

const Users = () => {
  const { isAdmin, loading } = useUserRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, Role[]>>({});

  const load = async () => {
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (p.data) setProfiles(p.data as Profile[]);
    if (r.data) {
      const map: Record<string, Role[]> = {};
      (r.data as any[]).forEach((row) => {
        if (!map[row.user_id]) map[row.user_id] = [];
        if (["admin", "editor", "guest"].includes(row.role)) map[row.user_id].push(row.role);
      });
      setRolesByUser(map);
    }
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const setStatus = async (userId: string, status: Profile["status"]) => {
    setProfiles((p) => p.map((x) => x.user_id === userId ? { ...x, status } : x));
    const { error } = await supabase.from("profiles").update({ status }).eq("user_id", userId);
    if (error) toast.error(error.message); else toast.success("Status aktualisiert");
  };

  const setRole = async (userId: string, role: Role) => {
    await supabase.from("user_roles").delete().eq("user_id", userId).in("role", ROLES);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success("Rolle aktualisiert"); load(); }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Profil & Rollen wirklich löschen? (Auth-Konto bleibt erhalten)")) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
    if (error) toast.error(error.message); else load();
  };

  if (loading) return <AdminLayout><div className="animate-pulse">Lade...</div></AdminLayout>;

  if (!isAdmin) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="md">
          <AdminCard className="p-10 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-destructive mb-3" />
            <h2 className="font-bold text-lg">Kein Zugriff</h2>
            <p className="text-sm text-muted-foreground">Nur Administratoren können diesen Bereich sehen.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper>
        <AdminPageHeader 
          icon={UsersIcon} 
          title="Benutzer" 
          description="Verwalte alle User, ihre Rollen und den Zugriffsstatus." 
        />

        <AdminSection spacing="md">
          <AdminCard 
            subtitle="Neue User starten mit Status 'Neu' und Rolle 'Gast'. Setze die Rolle auf Editor oder Administrator und Status auf Aktiv, um den User freizuschalten."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-Mail / Name</TableHead>
                    <TableHead>Registriert</TableHead>
                    <TableHead className="w-[160px]">Status</TableHead>
                    <TableHead className="w-[180px]">Rolle</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => {
                    const userRoles = rolesByUser[p.user_id] || [];
                    const currentRole: Role = userRoles.includes("admin") ? "admin" : userRoles.includes("editor") ? "editor" : "guest";
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-bold text-sm">{p.display_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("de-DE")}
                        </TableCell>
                        <TableCell>
                          <Select value={p.status} onValueChange={(v) => setStatus(p.user_id, v as any)}>
                            <SelectTrigger className={`h-8 text-xs font-bold ${p.status === 'active' ? 'text-green-600' : p.status === 'blocked' ? 'text-destructive' : 'text-orange-500'}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">Neu</SelectItem>
                              <SelectItem value="active">Aktiv</SelectItem>
                              <SelectItem value="blocked">Blockiert</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={currentRole} onValueChange={(v) => setRole(p.user_id, v as Role)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteUser(p.user_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {profiles.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Noch keine Profile.</p>}
            </div>
          </AdminCard>
        </AdminSection>
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default Users;