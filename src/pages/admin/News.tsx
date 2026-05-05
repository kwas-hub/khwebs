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

type Block = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  position: number;
};

const News = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("content_blocks")
      .select("*")
      .order("position", { ascending: true });
    if (error) toast.error(error.message);
    else setBlocks(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const addBlock = async () => {
    const { error } = await supabase.from("content_blocks").insert({
      title: "Neuer Bereich", content: "", published: false, position: blocks.length,
    });
    if (error) toast.error(error.message); else load();
  };

  const updateBlock = async (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const { error } = await supabase.from("content_blocks").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.from("content_blocks").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Aktuelle News</h1>
          <Button onClick={addBlock}><Plus className="mr-2 h-4 w-4" />Neuer Bereich</Button>
        </div>
        <div className="space-y-4">
          {blocks.map((block) => (
            <Card key={block.id} className="p-6 space-y-4">
              <Input value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Titel" className="font-semibold" />
              <Textarea value={block.content} onChange={(e) => updateBlock(block.id, { content: e.target.value })} placeholder="Inhalt..." rows={6} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={block.published} onCheckedChange={(v) => updateBlock(block.id, { published: v })} />
                  <Label>{block.published ? "Veröffentlicht" : "Privat"}</Label>
                </div>
                <Button variant="destructive" size="sm" onClick={() => deleteBlock(block.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {blocks.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Noch keine Bereiche. Klicke auf „Neuer Bereich".</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default News;
