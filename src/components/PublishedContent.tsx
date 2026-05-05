import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Block = { id: string; title: string; content: string };

const PublishedContent = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("content_blocks")
        .select("id,title,content")
        .eq("published", true)
        .order("position", { ascending: true });
      setBlocks(data ?? []);
    };
    load();

    const channel = supabase
      .channel("content_blocks_public")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_blocks" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (blocks.length === 0) return null;

  return (
    <section id="news" className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-4xl space-y-12">
        <h2 className="text-3xl md:text-4xl font-bold text-center">Aktuelles</h2>
        {blocks.map((b) => (
          <article key={b.id} className="space-y-3">
            {b.title && <h3 className="text-2xl font-semibold">{b.title}</h3>}
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{b.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default PublishedContent;
