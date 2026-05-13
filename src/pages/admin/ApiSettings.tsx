import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Send, RefreshCw, Plug, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
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

type Endpoint = {
  id: string; tenant_id: string; resource: string; name: string; enabled: boolean;
  target_url: string; auth_type: string; api_key: string | null;
  auth_username: string | null; auth_password: string | null;
  auto_export: boolean; filter_config: any;
};

type QueueItem = {
  id: string; tenant_id: string; resource: string; record_id: string; endpoint_id: string;
  status: string; retry_count: number; last_error: string | null;
  response_status: number | null; created_at: string; processed_at: string | null;
};

const RESOURCES = [
  { value: "documents", label: "Dokumente", icon: "📄" },
  { value: "termine", label: "Termine", icon: "📅" },
  { value: "news", label: "Aktuelle News", icon: "📰" },
  { value: "formulare", label: "Formulare", icon: "📝" },
];

const empty = (tenantId: string): Partial<Endpoint> => ({
  resource: "documents", name: "", enabled: true,
  target_url: "", auth_type: "bearer", api_key: "",
  auth_username: "", auth_password: "", auto_export: false, filter_config: {},
  tenant_id: tenantId,
});

const ApiSettingsPage = () => {
  const { currentTenant, isTenantAdmin } = useTenant();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [editing, setEditing] = useState<Partial<Endpoint> | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    
    const [{ data: eps }, { data: q }] = await Promise.all([
      supabase
        .from("api_endpoints")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("export_queue")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    
    setEndpoints((eps as any) ?? []);
    setQueue((q as any) ?? []);
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => { 
    load(); 
  }, [currentTenant?.id]);

  const save = async () => {
    if (!editing) return;
    if (!currentTenant) return toast.error("Kein Mandant ausgewählt");
    if (!editing.target_url) return toast.error("Ziel-URL erforderlich");
    
    const payload: any = {
      tenant_id: currentTenant.id,
      resource: editing.resource, 
      name: editing.name ?? "", 
      enabled: editing.enabled ?? true,
      target_url: editing.target_url, 
      auth_type: editing.auth_type ?? "bearer",
      api_key: editing.api_key || null,
      auth_username: editing.auth_username || null, 
      auth_password: editing.auth_password || null,
      auto_export: editing.auto_export ?? false,
      filter_config: editing.filter_config ?? {},
    };
    
    let error;
    if (editing.id) {
      ({ error } = await supabase
        .from("api_endpoints")
        .update(payload)
        .eq("id", editing.id)
        .eq("tenant_id", currentTenant.id));
    } else {
      ({ error } = await supabase.from("api_endpoints").insert(payload));
    }
    
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!currentTenant) return;
    if (!confirm("Endpunkt löschen?")) return;
    const { error } = await supabase
      .from("api_endpoints")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
      
    if (error) return toast.error(error.message);
    toast.success("Endpunkt gelöscht");
    load();
  };

  const testExport = async (ep: Endpoint) => {
    if (!currentTenant) return;
    toast.loading("Test-Export läuft...", { id: "test" });
    const { data, error } = await supabase.functions.invoke("export-record", {
      body: { 
        endpointId: ep.id, 
        resource: ep.resource, 
        test: true,
        tenant_id: currentTenant.id
      },
    });
    toast.dismiss("test");
    if (error) return toast.error(error.message);
    if (data?.ok) toast.success(`Erfolg (HTTP ${data.status})`);
    else toast.error(data?.error || "Fehlgeschlagen");
    load();
  };

  const retry = async (id: string) => {
    if (!currentTenant) return;
    const { error } = await supabase.functions.invoke("export-record", { 
      body: { queueId: id, tenant_id: currentTenant.id } 
    });
    if (error) return toast.error(error.message);
    toast.success("Erneut versendet");
    load();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <AdminPageHeader 
            icon={Plug} 
            title="API-Schnittstellen" 
            description="Verwalte API-Endpunkte für den Datenaustausch mit externen Systemen." 
          />
          <AdminCard className="p-12 text-center">
            <Plug className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="xl">
        <AdminPageHeader 
          icon={Plug} 
          title="API-Schnittstellen" 
          description={`Verwalte API-Endpunkte für den Datenaustausch mit externen Systemen.`}
          badge={`Mandant: ${currentTenant.name}`}
          actions={
            isTenantAdmin && (
              <Button onClick={() => setEditing(empty(currentTenant.id))}>
                <Plus className="h-4 w-4 mr-1" />
                Neuer Endpunkt
              </Button>
            )
          }
        />

        <AdminSection spacing="lg">
          {loading ? (
            <AdminCard className="p-12 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Lade API-Konfigurationen...</p>
            </AdminCard>
          ) : (
            <Tabs defaultValue="endpoints">
              <TabsList className="mb-6">
                <TabsTrigger value="endpoints">
                  Endpunkte <Badge variant="secondary" className="ml-2">{endpoints.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="queue">
                  Export-Queue <Badge variant="secondary" className="ml-2">{queue.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="endpoints">
                {endpoints.length === 0 ? (
                  <AdminCard className="p-12 text-center">
                    <Plug className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground mb-2">Noch keine Endpunkte konfiguriert.</p>
                    {isTenantAdmin && (
                      <Button variant="outline" onClick={() => setEditing(empty(currentTenant.id))}>
                        <Plus className="h-4 w-4 mr-1" />
                        Ersten Endpunkt anlegen
                      </Button>
                    )}
                  </AdminCard>
                ) : (
                  <div className="space-y-6">
                    {RESOURCES.map(resource => {
                      const items = endpoints.filter(e => e.resource === resource.value);
                      if (items.length === 0) return null;
                      return (
                        <AdminCard 
                          key={resource.value}
                          title={`${resource.icon} ${resource.label}`}
                          description={`${items.length} konfigurierte(r) Endpunkt(e)`}
                        >
                          <div className="space-y-3">
                            {items.map(ep => (
                              <div 
                                key={ep.id} 
                                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-all"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium truncate">{ep.name || "Unbenannter Endpunkt"}</span>
                                    {ep.enabled ? (
                                      <Badge variant="default" className="text-[10px]">Aktiv</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>
                                    )}
                                    {ep.auto_export && (
                                      <Badge variant="outline" className="text-[10px] bg-primary/5">Auto-Export</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
                                    {ep.target_url}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    Auth: {ep.auth_type === "bearer" ? "Bearer Token" : ep.auth_type === "basic" ? "Basic Auth" : "Keine"}
                                  </div>
                                </div>
                                <div className="flex gap-1 ml-4 flex-shrink-0">
                                  <Button size="sm" variant="ghost" onClick={() => testExport(ep)} title="Test-Export">
                                    <Send className="h-4 w-4" />
                                  </Button>
                                  {isTenantAdmin && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => setEditing(ep)} title="Bearbeiten">
                                        Bearbeiten
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => remove(ep.id)} title="Löschen">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AdminCard>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="queue">
                <AdminCard 
                  title="Export-Queue"
                  description="Letzte Export-Versuche und deren Status"
                  actions={
                    <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing}>
                      <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                      Aktualisieren
                    </Button>
                  }
                >
                  {queue.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Keine Exporte in der Queue.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Ressource</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>HTTP</TableHead>
                            <TableHead>Versuche</TableHead>
                            <TableHead>Fehler</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queue.map(q => (
                            <TableRow key={q.id} className="hover:bg-muted/30">
                              <TableCell className="text-xs whitespace-nowrap">
                                {new Date(q.created_at).toLocaleString("de-DE")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {RESOURCES.find(r => r.value === q.resource)?.label || q.resource}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {getStatusIcon(q.status)}
                                  <Badge 
                                    variant={
                                      q.status === "success" ? "default" : 
                                      q.status === "failed" ? "destructive" : "secondary"
                                    } 
                                    className="text-[10px]"
                                  >
                                    {q.status === "success" ? "Erfolg" : q.status === "failed" ? "Fehler" : "Ausstehend"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-mono">{q.response_status ?? "-"}</TableCell>
                              <TableCell className="text-xs">{q.retry_count}</TableCell>
                              <TableCell className="text-xs text-destructive max-w-[260px] truncate" title={q.last_error || ""}>
                                {q.last_error || "-"}
                              </TableCell>
                              <TableCell>
                                {q.status !== "success" && (
                                  <Button size="sm" variant="ghost" onClick={() => retry(q.id)} title="Erneut versuchen">
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </AdminCard>
              </TabsContent>
            </Tabs>
          )}
        </AdminSection>

        {/* Edit Modal / Inline Form mit Admin-Komponenten */}
        {editing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
            <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <AdminCard 
                title={editing.id ? "Endpunkt bearbeiten" : "Neuen Endpunkt erstellen"}
                description="Konfiguriere die API-Endpunkt-Einstellungen"
                className="border-primary/40 shadow-xl"
              >
                <div className="space-y-4">
                  <AdminFormRow columns={2}>
                    <AdminFieldGroup label="Name" optional>
                      <Input 
                        value={editing.name ?? ""} 
                        onChange={e => setEditing({ ...editing, name: e.target.value })} 
                        placeholder="z.B. DMS Produktion" 
                      />
                    </AdminFieldGroup>
                    <AdminFieldGroup label="Ressource" required>
                      <Select value={editing.resource} onValueChange={v => setEditing({ ...editing, resource: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RESOURCES.map(r => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.icon} {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </AdminFieldGroup>
                  </AdminFormRow>

                  <AdminFieldGroup label="Ziel-URL" required>
                    <Input 
                      value={editing.target_url ?? ""} 
                      onChange={e => setEditing({ ...editing, target_url: e.target.value })} 
                      placeholder="https://api.example.com/import" 
                    />
                  </AdminFieldGroup>

                  <AdminDivider spacing="sm" />

                  <AdminFormRow columns={2}>
                    <AdminFieldGroup label="Auth-Typ" required>
                      <Select value={editing.auth_type} onValueChange={v => setEditing({ ...editing, auth_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                          <SelectItem value="none">Keine Authentifizierung</SelectItem>
                        </SelectContent>
                      </Select>
                    </AdminFieldGroup>

                    {editing.auth_type === "bearer" && (
                      <AdminFieldGroup label="API-Key" required>
                        <Input 
                          type="password" 
                          value={editing.api_key ?? ""} 
                          onChange={e => setEditing({ ...editing, api_key: e.target.value })} 
                          placeholder="sk-..."
                        />
                      </AdminFieldGroup>
                    )}
                  </AdminFormRow>

                  {editing.auth_type === "basic" && (
                    <AdminFormRow columns={2}>
                      <AdminFieldGroup label="Benutzername" required>
                        <Input 
                          value={editing.auth_username ?? ""} 
                          onChange={e => setEditing({ ...editing, auth_username: e.target.value })} 
                        />
                      </AdminFieldGroup>
                      <AdminFieldGroup label="Passwort" required>
                        <Input 
                          type="password" 
                          value={editing.auth_password ?? ""} 
                          onChange={e => setEditing({ ...editing, auth_password: e.target.value })} 
                        />
                      </AdminFieldGroup>
                    </AdminFormRow>
                  )}

                  <AdminDivider spacing="sm" />

                  <div className="flex gap-6 items-center">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch 
                        checked={editing.enabled ?? false} 
                        onCheckedChange={v => setEditing({ ...editing, enabled: v })} 
                      />
                      <span className="text-sm">Aktiv</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch 
                        checked={editing.auto_export ?? false} 
                        onCheckedChange={v => setEditing({ ...editing, auto_export: v })} 
                      />
                      <span className="text-sm">Automatischer Export</span>
                    </label>
                  </div>

                  <AdminDivider spacing="sm" />

                  <div className="flex gap-2 pt-2">
                    <Button onClick={save}>Speichern</Button>
                    <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
                  </div>
                </div>
              </AdminCard>
            </div>
          </div>
        )}
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default ApiSettingsPage;