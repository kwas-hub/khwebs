import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Newspaper, Eye, EyeOff, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AdminPageHeader,
  AdminCard,
  AdminSection,
  AdminContentWrapper,
  AdminFieldGroup,
  AdminFormRow,
  AdminDivider,
} from "@/components/admin";

type Block = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  position: number;
  tenant_id: string;
  created_at?: string;
  updated_at?: string;
};

const News = () => {
  const { userId } = useAuth();
  const { currentTenant, isTenantAdmin } = useTenant();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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
      console.error("Fehler beim Laden:", error);
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
    
    if (!isTenantAdmin) {
      toast.error("Nur Mandanten-Administratoren können Bereiche erstellen");
      return;
    }
    
    setIsCreating(true);
    
    const nextPosition = blocks.length;
    
    const { error } = await supabase.from("content_blocks").insert({
      title: "Neuer Bereich",
      content: "",
      published: false,
      position: nextPosition,
      tenant_id: currentTenant.id,
    });
    
    setIsCreating(false);
    
    if (error) {
      console.error("Fehler beim Erstellen:", error);
      if (error.message.includes("violates row-level security")) {
        toast.error("Keine Berechtigung: Bitte kontaktieren Sie den Administrator");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Bereich erstellt");
      load();
    }
  };

  const updateBlock = async (id: string, patch: Partial<Block>) => {
    if (!currentTenant) return;
    
    // Optimistisches Update
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    
    const { error } = await supabase
      .from("content_blocks")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    
    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      toast.error(error.message);
      load(); // Reload bei Fehler
    }
  };

  const deleteBlock = async (id: string) => {
    if (!currentTenant) return;
    if (!confirm("Diesen Bereich wirklich löschen?")) return;
    
    const { error } = await supabase
      .from("content_blocks")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    
    if (error) {
      console.error("Fehler beim Löschen:", error);
      toast.error(error.message);
    } else {
      toast.success("Bereich gelöscht");
      load();
    }
  };

  const moveBlock = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    
    const arr = [...blocks];
    const a = arr[index];
    const b = arr[newIndex];
    
    // Tausche Positionen
    const tempPos = a.position;
    a.position = b.position;
    b.position = tempPos;
    
    arr[index] = b;
    arr[newIndex] = a;
    
    // Sortiere nach neuer Position
    arr.sort((x, y) => x.position - y.position);
    setBlocks(arr);
    
    // Update in DB
    await Promise.all([
      supabase
        .from("content_blocks")
        .update({ position: a.position })
        .eq("id", a.id)
        .eq("tenant_id", currentTenant?.id),
      supabase
        .from("content_blocks")
        .update({ position: b.position })
        .eq("id", b.id)
        .eq("tenant_id", currentTenant?.id),
    ]);
  };

  if (!currentTenant) {
    return (
      <AdminLayout>
        <AdminContentWrapper maxWidth="xl">
          <AdminPageHeader 
            icon={Newspaper} 
            title="Aktuelle News" 
            description="Verwalte Nachrichten und Inhaltsbereiche" 
          />
          <AdminCard className="p-12 text-center">
            <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus dem Dropdown-Menü oben rechts.</p>
          </AdminCard>
        </AdminContentWrapper>
      </AdminLayout>
    );
  }

  const publishedCount = blocks.filter(b => b.published).length;
  const draftCount = blocks.filter(b => !b.published).length;

  return (
    <AdminLayout>
      <AdminContentWrapper maxWidth="xl">
        <AdminPageHeader 
          icon={Newspaper} 
          title="Aktuelle News" 
          description={`Verwalte die Inhaltsbereiche für ${currentTenant.name}`}
          badge={`${blocks.length} Bereich(e) • ${publishedCount} veröffentlicht • ${draftCount} Entwurf`}
          actions={
            isTenantAdmin && (
              <Button onClick={addBlock} disabled={isCreating}>
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Wird erstellt...
                  </div>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Neuer Bereich
                  </>
                )}
              </Button>
            )
          }
        />
        
        {loading ? (
          <AdminCard className="p-12 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Lade News-Bereiche...
            </div>
          </AdminCard>
        ) : (
          <AdminSection spacing="lg">
            {blocks.map((block, index) => (
              <AdminCard 
                key={block.id}
                title={block.title || "Unbenannter Bereich"}
                description={`Position: ${block.position + 1} • Erstellt: ${block.created_at ? new Date(block.created_at).toLocaleDateString("de-DE") : "Neu"}`}
                className="hover:border-primary/30 transition-all"
                actions={
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col gap-0.5 mr-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        disabled={index === 0 || !isTenantAdmin} 
                        onClick={() => moveBlock(index, 'up')}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        disabled={index === blocks.length - 1 || !isTenantAdmin} 
                        onClick={() => moveBlock(index, 'down')}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    {isTenantAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10" 
                        onClick={() => deleteBlock(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                }
                footer={
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={block.published} 
                        onCheckedChange={(v) => updateBlock(block.id, { published: v })}
                        disabled={!isTenantAdmin}
                      />
                      <Label className="text-xs font-medium cursor-pointer flex items-center gap-1">
                        {block.published ? (
                          <>
                            <Eye className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600">Veröffentlicht</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-600">Entwurf</span>
                          </>
                        )}
                      </Label>
                    </div>
                    {block.published && (
                      <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700">
                        Sichtbar für Besucher
                      </Badge>
                    )}
                  </div>
                }
              >
                <div className="space-y-4">
                  <AdminFieldGroup label="Titel" required>
                    <Input 
                      value={block.title} 
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })} 
                      placeholder="z.B. Willkommen bei uns"
                      disabled={!isTenantAdmin}
                      className="text-lg font-medium"
                    />
                  </AdminFieldGroup>
                  
                  <AdminDivider spacing="sm" />
                  
                  <AdminFieldGroup label="Inhalt" optional>
                    <Textarea 
                      value={block.content} 
                      onChange={(e) => updateBlock(block.id, { content: e.target.value })} 
                      placeholder="Schreibe hier deinen Text... Du kannst HTML verwenden für Formatierungen."
                      rows={8}
                      disabled={!isTenantAdmin}
                      className="font-mono text-sm resize-y"
                    />
                  </AdminFieldGroup>
                  
                  <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-md">
                    <strong>Tipp:</strong> Du kannst HTML-Tags wie <code className="bg-muted px-1 rounded">&lt;strong&gt;</code>, 
                    <code className="bg-muted px-1 rounded">&lt;em&gt;</code>, <code className="bg-muted px-1 rounded">&lt;ul&gt;</code> und 
                    <code className="bg-muted px-1 rounded">&lt;li&gt;</code> verwenden.
                  </div>
                </div>
              </AdminCard>
            ))}
            
            {blocks.length === 0 && (
              <AdminCard className="p-12 text-center border-2 border-dashed">
                <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground mb-2">Noch keine News-Bereiche angelegt.</p>
                <p className="text-xs text-muted-foreground mb-4">Erstelle deinen ersten Inhaltsbereich für die Startseite.</p>
                {isTenantAdmin && (
                  <Button variant="outline" onClick={addBlock} disabled={isCreating}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ersten Bereich erstellen
                  </Button>
                )}
              </AdminCard>
            )}
          </AdminSection>
        )}
      </AdminContentWrapper>
    </AdminLayout>
  );
};

export default News;