import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

type Block = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  position: number;
  tenant_id: string;
};

const News = () => {
  const { currentTenant, isTenantAdmin } = useTenant();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentTenant) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const { data, error } = await supabase
      .from("content_blocks")
      .select("*")
      .eq("tenant_id", currentTenant.id)  // 🔑 Nur Daten des aktuellen Mandanten laden
      .order("position", { ascending: true });
    
    if (error) {
      toast.error(error.message);
    } else {
      setBlocks(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { 
    load(); 
  }, [currentTenant]); // 🔑 Bei Mandanten-Wechsel neu laden

  const addBlock = async () => {
    if (!currentTenant) {
      toast.error("Kein Mandant ausgewählt");
      return;
    }
    
    const { error } = await supabase.from("content_blocks").insert({
      title: "Neuer Bereich",
      content: "",
      published: false,
      position: blocks.length,
      tenant_id: currentTenant.id,  // 🔑 Mandant zuweisen
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      load();
    }
  };

  const updateBlock = async (id: string, patch: Partial<Block>) => {
    // Optimistisches Update
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    
    const { error } = await supabase
      .from("content_blocks")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", currentTenant?.id); // 🔑 Sicherheitshalber auch tenant_id prüfen
    
    if (error) {
      toast.error(error.message);
      load(); // Bei Fehler neu laden
    }
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase
      .from("content_blocks")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant?.id); // 🔑 Sicherheitshalber tenant_id prüfen
    
    if (error) {
      toast.error(error.message);
    } else {
      load();
    }
  };

  // Keine Admin-Rechte? Dann keine Bearbeitung erlauben
  const canEdit = isTenantAdmin;

  if (!currentTenant) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Aktuelle News</h1>
          </div>
          <Card className="p-12 text-center text-muted-foreground">
            <p>Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Aktuelle News</h1>
            <p className="text-sm text-muted-foreground">
              Mandant: <span className="font-medium">{currentTenant.name}</span>
            </p>
          </div>
          {canEdit && (
            <Button onClick={addBlock}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Bereich
            </Button>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Lade News...</div>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => (
              <Card key={block.id} className="p-6 space-y-4">
                <Input 
                  value={block.title} 
                  onChange={(e) => updateBlock(block.id, { title: e.target.value })} 
                  placeholder="Titel" 
                  className="font-semibold"
                  disabled={!canEdit}
                />
                <Textarea 
                  value={block.content} 
                  onChange={(e) => updateBlock(block.id, { content: e.target.value })} 
                  placeholder="Inhalt..." 
                  rows={6}
                  disabled={!canEdit}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={block.published} 
                      onCheckedChange={(v) => updateBlock(block.id, { published: v })}
                      disabled={!canEdit}
                    />
                    <Label>{block.published ? "Veröffentlicht" : "Privat"}</Label>
                  </div>
                  {canEdit && (
                    <Button variant="destructive" size="sm" onClick={() => deleteBlock(block.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            
            {blocks.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                Noch keine Bereiche. Klicke auf „Neuer Bereich".
              </p>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default News;
