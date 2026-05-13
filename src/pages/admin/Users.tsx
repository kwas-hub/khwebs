import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";  // ← FEHLENDER IMPORT
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Users as UsersIcon, ShieldAlert, Shield, UserCog, User, Calendar, Mail, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import {
  AdminPageHeader,
  AdminCard,
  AdminSection,
  AdminContentWrapper,
  AdminDivider,
} from "@/components/admin";

type Profile = {
  id: string; user_id: string; email: string; display_name: string;
  status: "new" | "active" | "blocked"; created_at: string;
};
type Role = "admin" | "editor" | "guest";

const ROLES: Role[] = ["admin", "editor", "guest"];
const ROLE_LABELS: Record<Role, string> = { admin: "Administrator", editor: "Editor", guest: "Gast" };
const ROLE_ICONS: Record<Role, any> = { admin: Shield, editor: UserCog, guest: User };
const ROLE_COLORS: Record<Role, string> = { admin: "text-purple-600", editor: "text-blue-600", guest: "text-gray-600" };

const Users = () => {
  const { isAdmin, loading } = useUserRole();
  const { userId } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, Role[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
  
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    toast.success("Benutzerliste aktualisiert");
  };
  
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const setStatus = async (userId: string, status: Profile["status"]) => {
    setProfiles((p) => p.map((x) => x.user_id === userId ? { ...x, status } : x));
    const { error } = await supabase.from("profiles").update({ status }).eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success(`Status auf ${status === "active" ? "Aktiv" : status === "blocked" ? "Blockiert" : "Neu"} gesetzt`);
    }
  };

  const setRole = async (userId: string, role: Role) => {
    await supabase.from("user_roles").delete().eq("user_id", userId).in("role", ROLES);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success(`Rolle auf ${ROLE_LABELS[role]} geändert`); load(); }
  };

  const deleteUser = async (userIdToDelete: string) => {
    if (userIdToDelete === userId) {
      toast.error("Du kannst dein eigenes Profil nicht löschen");
      return;
    }
    if (!confirm(`Profil wirklich löschen? Der Benutzer kann sich weiterhin anmelden, verliert aber alle Berechtigungen.`)) return;
    
    await supabase.from("user_roles").delete().eq("user_id", userIdToDelete);
    const { error } = await supabase.from("profiles").delete().eq("user_id", userIdToDelete);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Benutzer gelöscht");
      load();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case "blocked": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "blocked": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-amber-600 bg-amber-50 border-amber-200";
    }
  };

  const filteredProfiles = profiles.filter(profile => 
    profile.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: profiles.length,
    active: profiles.filter(p => p.status === "active").length,
    new: profiles.filter(p => p.status === "new").length,
    blocked: profiles.filter(p => p.status === "blocked").length,
    admins: Object.values(rolesByUser).filter(roles => roles.includes("admin")).length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <AdminCard className="p-12 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Lade Benutzerverwaltung...</span>
            </div>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="md">
          <AdminCard className="p-12 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4 opacity-80" />
            <h2 className="font-bold text-xl mb-2">Kein Zugriff</h2>
            <p className="text-sm text-muted-foreground">
              Nur Administratoren können die Benutzerverwaltung einsehen.
            </p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="xl">
        <AdminPageHeader 
          icon={UsersIcon} 
          title="Benutzer" 
          description="Verwalte alle Benutzer, ihre Rollen und Zugriffsrechte"
          badge={`${stats.total} Benutzer • ${stats.active} aktiv • ${stats.new} neu`}
          actions={
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          }
        />

        {/* Statistik-Karten */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <AdminCard className="p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Gesamt</div>
          </AdminCard>
          <AdminCard className="p-3 text-center border-emerald-200 bg-emerald-50/30">
            <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            <div className="text-xs text-emerald-600">Aktiv</div>
          </AdminCard>
          <AdminCard className="p-3 text-center border-amber-200 bg-amber-50/30">
            <div className="text-2xl font-bold text-amber-600">{stats.new}</div>
            <div className="text-xs text-amber-600">Neu</div>
          </AdminCard>
          <AdminCard className="p-3 text-center border-red-200 bg-red-50/30">
            <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
            <div className="text-xs text-red-600">Blockiert</div>
          </AdminCard>
          <AdminCard className="p-3 text-center border-purple-200 bg-purple-50/30">
            <div className="text-2xl font-bold text-purple-600">{stats.admins}</div>
            <div className="text-xs text-purple-600">Administratoren</div>
          </AdminCard>
        </div>

        <AdminSection spacing="md">
          <AdminCard 
            title="Benutzerliste"
            description="Verwalte Benutzerkonten, Status und Berechtigungen"
          >
            {/* Suchfeld */}
            <div className="mb-4">
              <Input
                placeholder="Nach E-Mail oder Name suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benutzer</TableHead>
                    <TableHead>Registriert</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[160px]">Rolle</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => {
                    const userRoles = rolesByUser[profile.user_id] || [];
                    const currentRole: Role = userRoles.includes("admin") ? "admin" : userRoles.includes("editor") ? "editor" : "guest";
                    const RoleIcon = ROLE_ICONS[currentRole];
                    const isCurrentUser = profile.user_id === userId;
                    
                    return (
                      <TableRow key={profile.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">
                                {(profile.display_name?.[0] || profile.email?.[0] || "?").toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-1.5">
                                {profile.display_name || "—"}
                                {isCurrentUser && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    Du
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {profile.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(profile.created_at).toLocaleDateString("de-DE", {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={profile.status} 
                            onValueChange={(v) => setStatus(profile.user_id, v as any)}
                          >
                            <SelectTrigger className={`h-8 text-xs font-medium ${getStatusColor(profile.status)} border-0 focus:ring-1`}>
                              <div className="flex items-center gap-1.5">
                                {getStatusIcon(profile.status)}
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                  <span>Neu</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="active">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                  <span>Aktiv</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="blocked">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                                  <span>Blockiert</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={currentRole} 
                            onValueChange={(v) => setRole(profile.user_id, v as Role)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <div className="flex items-center gap-1.5">
                                <RoleIcon className={`h-3.5 w-3.5 ${ROLE_COLORS[currentRole]}`} />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => {
                                const Icon = ROLE_ICONS[role];
                                return (
                                  <SelectItem key={role} value={role}>
                                    <div className="flex items-center gap-2">
                                      <Icon className={`h-3.5 w-3.5 ${ROLE_COLORS[role]}`} />
                                      <span>{ROLE_LABELS[role]}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive h-8 w-8 hover:bg-destructive/10" 
                            onClick={() => deleteUser(profile.user_id)}
                            disabled={isCurrentUser}
                            title={isCurrentUser ? "Du kannst dein eigenes Profil nicht löschen" : "Benutzer löschen"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {filteredProfiles.length === 0 && (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
                  <UsersIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {searchTerm ? "Keine Benutzer gefunden, die deiner Suche entsprechen." : "Noch keine Benutzer registriert."}
                  </p>
                  {searchTerm && (
                    <Button variant="link" size="sm" onClick={() => setSearchTerm("")} className="mt-2">
                      Suche zurücksetzen
                    </Button>
                  )}
                </div>
              )}
            </div>

            <AdminDivider spacing="md" />

            {/* Hilfe-Bereich */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Rollen & Berechtigungen
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 text-purple-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Administrator</span>
                    <p className="text-muted-foreground">Voller Zugriff auf alle Bereiche, inkl. Benutzerverwaltung und API-Einstellungen.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <UserCog className="h-3.5 w-3.5 text-blue-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Editor</span>
                    <p className="text-muted-foreground">Kann Inhalte bearbeiten, aber keine Benutzer oder API-Einstellungen verwalten.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-3.5 w-3.5 text-gray-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Gast</span>
                    <p className="text-muted-foreground">Nur Lesezugriff auf öffentliche Inhalte.</p>
                  </div>
                </div>
              </div>
            </div>
          </AdminCard>
        </AdminSection>
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default Users;