import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Newspaper } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { AdminPageHeader, AdminCard, AdminSection, AdminContentWrapper, AdminFieldGroup } from "@/components/admin";

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
      .eq("tenant_id", currentTenant.id)
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
  }, [currentTenant]);

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
      tenant_id: currentTenant.id,
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      load();
    }
  };

  const updateBlock = async (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    
    const { error } = await supabase
      .from("content_blocks")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", currentTenant?.id);
    
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const deleteBlock = async (id: string) => {
    if (!confirm("Diesen Bereich wirklich löschen?")) return;
    const { error } = await supabase
      .from("content_blocks")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant?.id);
    
    if (error) {
      toast.error(error.message);
    } else {
      load();
    }
  };

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper>
          <AdminPageHeader icon={Newspaper} title="Aktuelle News" />
          <AdminCard className="p-12 text-center text-muted-foreground">
            <p>Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminContentWrapper>
        <AdminPageHeader 
          icon={Newspaper} 
          title="Aktuelle News" 
          description={`Verwalte die Inhalte für ${currentTenant.name}`}
          actions={isTenantAdmin && (
            <Button onClick={addBlock}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Bereich
            </Button>
          )}
        />
        
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Lade News...</div>
        ) : (
          <AdminSection spacing="md">
            {blocks.map((block) => (
              <AdminCard 
                key={block.id}
                title={block.title || "Unbenannter Bereich"}
                actions={isTenantAdmin && (
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteBlock(block.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                footer={
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={block.published} 
                      onCheckedChange={(v) => updateBlock(block.id, { published: v })}
                      disabled={!isTenantAdmin}
                    />
                    <Label className="text-xs font-bold uppercase">{block.published ? "Veröffentlicht" : "Privat"}</Label>
                  </div>
                }
              >
                <div className="space-y-4">
                  <AdminFieldGroup label="Titel">
                    <Input 
                      value={block.title} 
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })} 
                      placeholder="Titel des Bereichs" 
                      disabled={!isTenantAdmin}
                    />
                  </AdminFieldGroup>
                  <AdminFieldGroup label="Inhalt">
                    <Textarea 
                      value={block.content} 
                      onChange={(e) => updateBlock(block.id, { content: e.target.value })} 
                      placeholder="Schreibe hier deinen Text..." 
                      rows={6}
                      disabled={!isTenantAdmin}
                    />
                  </AdminFieldGroup>
                </div>
              </AdminCard>
            ))}
            
            {blocks.length === 0 && (
              <div className="text-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed border-border/50">
                <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-muted-foreground">Noch keine News-Bereiche angelegt.</p>
                {isTenantAdmin && <Button variant="outline" className="mt-4" onClick={addBlock}>Ersten Bereich erstellen</Button>}
              </div>
            )}
          </AdminSection>
        )}
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default News;