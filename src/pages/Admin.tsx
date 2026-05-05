import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, LogOut } from "lucide-react";

type Block = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  position: number;
};

const Admin = () => {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const admin = roles?.some((r) => r.role === "admin") ?? false;
      setIsAdmin(admin);
      if (!admin) {
        toast.error("Keine Admin-Berechtigung");
        setLoading(false);
        return;
      }
      await loadBlocks();
      setLoading(false);
    };
    init();
  }, [navigate]);

  const loadBlocks = async () => {
    const { data, error } = await supabase
      .from("content_blocks")
      .select("*")
      .order("position", { ascending: true });
    if (error) toast.error(error.message);
    else setBlocks(data ?? []);
  };

  const addBlock = async () => {
    const { error } = await supabase.from("content_blocks").insert({
      title: "Neuer Bereich",
      content: "",
      published: false,
      position: blocks.length,
    });
    if (error) toast.error(error.message);
    else loadBlocks();
  };

  const updateBlock = async (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const { error } = await supabase.from("content_blocks").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.from("content_blocks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else loadBlocks();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Lädt...</div>;
  if (!isAdmin)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p>Du hast keinen Admin-Zugriff.</p>
        <Button onClick={logout}>Logout</Button>
      </div>
    );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Admin-Bereich</h1>
          <div className="flex gap-2">
            <Button onClick={addBlock}><Plus className="mr-2 h-4 w-4" />Neuer Bereich</Button>
            <Button variant="outline" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
          </div>
        </div>

        <div className="space-y-4">
          {blocks.map((block) => (
            <Card key={block.id} className="p-6 space-y-4">
              <Input
                value={block.title}
                onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                placeholder="Titel"
                className="font-semibold"
              />
              <Textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                placeholder="Inhalt..."
                rows={6}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={block.published}
                    onCheckedChange={(v) => updateBlock(block.id, { published: v })}
                  />
                  <Label>{block.published ? "Veröffentlicht" : "Privat"}</Label>
                </div>
                <Button variant="destructive" size="sm" onClick={() => deleteBlock(block.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {blocks.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              Noch keine Bereiche. Klicke auf „Neuer Bereich".
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
