import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import { invokeAiTenant } from "@/lib/aiTenantEdge";

type Msg = { role: "user" | "assistant"; text: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  documentId: string | null;
  aiEnabled: boolean;
};

export function AIChatSidebar({ open, onOpenChange, tenantId, documentId, aiEnabled }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const q = input.trim();
    if (!q || !documentId || !aiEnabled) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await invokeAiTenant<{ answer: string; used_rag?: boolean }>({
        action: "chat",
        tenant_id: tenantId,
        document_id: documentId,
        question: q,
      });
      const suffix = res.used_rag ? "" : " (Volltext-Fallback)";
      setMessages((m) => [...m, { role: "assistant", text: (res.answer ?? "") + suffix }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => [...m, { role: "assistant", text: `Fehler: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-3">
        <SheetHeader>
          <SheetTitle>Chat zum Dokument</SheetTitle>
          {!aiEnabled && (
            <p className="text-xs text-muted-foreground font-normal">
              Keine aktive KI-Konfiguration. Bitte Mandanten-Admin informieren.
            </p>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-[50vh] border rounded-md p-3">
          <div className="space-y-3 text-sm">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-xs">Stellen Sie Fragen zum erkannten Text (RAG).</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg p-2 ${m.role === "user" ? "bg-primary/10 ml-4" : "bg-muted mr-4"}`}
              >
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  {m.role === "user" ? "Sie" : "KI"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-4 w-4 animate-spin" /> Antwort wird geladen…
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage eingeben…"
            rows={2}
            disabled={!documentId || !aiEnabled || loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="resize-none"
          />
          <Button type="button" size="icon" className="shrink-0" disabled={!documentId || !aiEnabled || loading} onClick={() => void send()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
