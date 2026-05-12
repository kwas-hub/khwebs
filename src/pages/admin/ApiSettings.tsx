import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Send, RefreshCw, Plug } from "lucide-react";
import { toast } from "sonner";

type Endpoint = {
  id: string; tenant_id: string; resource: string; name: string; enabled: boolean;
  target_url: string; auth_type: string; api_key: string | null;
  auth_username: string | null; auth_password: string | null;
  auto_export: boolean; filter_config: any;
};

type QueueItem = {
  id: string; resource: string; record_id: string; endpoint_id: string;
  status: string; retry_count: number; last_error: string | null;
  response_status: number | null; created_at: string; processed_at: string | null;
};

const RESOURCES = [
  { value: "documents", label: "Dokumente" },
  { value: "termine", label: "Termine" },
  { value: "news", label: "Aktuelle News" },
  { value: "formulare", label: "Formulare" },
];

const empty = (): Partial<Endpoint> => ({
  resource: "documents", name: "", enabled: true,
  target_url: "", auth_type: "bearer", api_key: "",
  auth_username: "", auth_password: "", auto_export: false, filter_config: {},
});

const ApiSettingsPage = () => {
  const { currentTenantId, isTenantAdmin } = useTenant();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [editing, setEditing] = useState<Partial<Endpoint> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    const [{ data: eps }, { data: q }] = await Promise.all([
      supabase.from("api_endpoints").select("*").order("created_at", { ascending: false }),
      supabase.from("export_queue").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setEndpoints((eps as any) ?? []);
    setQueue((q as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentTenantId]);

  const save = async () => {
    if (!editing) return;
    if (!editing.target_url) return toast.error("Ziel-URL erforderlich");
    const payload: any = {
      resource: editing.resource, name: editing.name ?? "", enabled: editing.enabled ?? true,
      target_url: editing.target_url, auth_type: editing.auth_type ?? "bearer",
      api_key: editing.api_key || null,
      auth_username: editing.auth_username || null, auth_password: editing.auth_password || null,
      auto_export: editing.auto_export ?? false,
      filter_config: editing.filter_config ?? {},
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("api_endpoints").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("api_endpoints").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Endpunkt löschen?")) return;
    const { error } = await supabase.from("api_endpoints").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const testExport = async (ep: Endpoint) => {
    toast.loading("Test-Export läuft...", { id: "test" });
    const { data, error } = await supabase.functions.invoke("export-record", {
      body: { endpointId: ep.id, resource: ep.resource, test: true },
    });
    toast.dismiss("test");
    if (error) return toast.error(error.message);
    if (data?.ok) toast.success(`Erfolg (HTTP ${data.status})`);
    else toast.error(data?.error || "Fehlgeschlagen");
    load();
  };

  const retry = async (id: string) => {
    const { error } = await supabase.functions.invoke("export-record", { body: { queueId: id } });
    if (error) return toast.error(error.message);
    toast.success("Erneut versendet");
    load();
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plug className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">API-Schnittstellen</h1>
          </div>
          {isTenantAdmin && (
            <Button onClick={() => setEditing(empty())}><Plus className="w-4 h-4 mr-1" />Neuer Endpunkt</Button>
          )}
        </div>

        <Tabs defaultValue="endpoints">
          <TabsList>
            <TabsTrigger value="endpoints">Endpunkte ({endpoints.length})</TabsTrigger>
            <TabsTrigger value="queue">Export-Queue ({queue.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-4">
            {RESOURCES.map(r => {
              const items = endpoints.filter(e => e.resource === r.value);
              if (items.length === 0) return null;
              return (
                <Card key={r.value} className="p-4">
                  <h3 className="font-semibold mb-3">{r.label}</h3>
                  <div className="space-y-2">
                    {items.map(ep => (
                      <div key={ep.id} className="flex items-center justify-between p-3 border rounded-lg gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{ep.name || ep.target_url}</span>
                            {ep.enabled ? <Badge variant="default" className="text-[10px]">Aktiv</Badge> : <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>}
                            {ep.auto_export && <Badge variant="outline" className="text-[10px]">Auto-Export</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{ep.target_url}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => testExport(ep)}><Send className="w-4 h-4" /></Button>
                          {isTenantAdmin && <Button size="sm" variant="ghost" onClick={() => setEditing(ep)}>Bearbeiten</Button>}
                          {isTenantAdmin && <Button size="sm" variant="ghost" onClick={() => remove(ep.id)}><Trash2 className="w-4 h-4" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
            {endpoints.length === 0 && (
              <Card className="p-12 text-center text-muted-foreground">
                Noch keine Endpunkte konfiguriert.
              </Card>
            )}
          </TabsContent>

          <TabsContent value="queue">
            <Card className="p-4">
              <div className="flex justify-between mb-3">
                <h3 className="font-semibold">Letzte Exporte</h3>
                <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Aktualisieren</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Ressource</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Versuche</TableHead>
                    <TableHead>Fehler</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map(q => (
                    <TableRow key={q.id}>
                      <TableCell className="text-xs">{new Date(q.created_at).toLocaleString("de-DE")}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{q.resource}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={q.status === "success" ? "default" : q.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{q.response_status ?? "-"}</TableCell>
                      <TableCell className="text-xs">{q.retry_count}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[260px] truncate">{q.last_error}</TableCell>
                      <TableCell>
                        {q.status !== "success" && (
                          <Button size="sm" variant="ghost" onClick={() => retry(q.id)}><RefreshCw className="w-3 h-3" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {queue.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Keine Exporte</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {editing && (
          <Card className="p-6 space-y-4 border-primary/40">
            <h2 className="text-lg font-semibold">{editing.id ? "Endpunkt bearbeiten" : "Neuer Endpunkt"}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="DMS Produktion" />
              </div>
              <div>
                <Label>Ressource</Label>
                <Select value={editing.resource} onValueChange={v => setEditing({ ...editing, resource: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Ziel-URL</Label>
                <Input value={editing.target_url ?? ""} onChange={e => setEditing({ ...editing, target_url: e.target.value })} placeholder="https://api.example.com/import" />
              </div>
              <div>
                <Label>Auth-Typ</Label>
                <Select value={editing.auth_type} onValueChange={v => setEditing({ ...editing, auth_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="none">Keine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.auth_type === "bearer" && (
                <div>
                  <Label>API-Key</Label>
                  <Input type="password" value={editing.api_key ?? ""} onChange={e => setEditing({ ...editing, api_key: e.target.value })} />
                </div>
              )}
              {editing.auth_type === "basic" && (
                <>
                  <div>
                    <Label>Benutzer</Label>
                    <Input value={editing.auth_username ?? ""} onChange={e => setEditing({ ...editing, auth_username: e.target.value })} />
                  </div>
                  <div>
                    <Label>Passwort</Label>
                    <Input type="password" value={editing.auth_password ?? ""} onChange={e => setEditing({ ...editing, auth_password: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing.enabled ?? false} onCheckedChange={v => setEditing({ ...editing, enabled: v })} />
                Aktiv
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing.auto_export ?? false} onCheckedChange={v => setEditing({ ...editing, auto_export: v })} />
                Automatischer Export
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={save}>Speichern</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default ApiSettingsPage;
