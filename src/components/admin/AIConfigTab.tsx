import { useCallback, useEffect, useState } from "react";
import { invokeAiTenant } from "@/lib/aiTenantEdge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AdminCard, AdminFieldGroup } from "@/components/admin";
import { toast } from "sonner";
import { Loader2, Plug, Save, Trash2, Eye, EyeOff } from "lucide-react";

export type AiProvider = "ollama" | "groq" | "openai" | "google" | "mistral" | "deepseek" | "custom";

const PRESETS: Record<
  AiProvider,
  { base_url: string; models: string[]; embedding: string }
> = {
  ollama: {
    base_url: "http://localhost:11434/v1",
    models: ["llama3.1:8b", "mistral:latest"],
    embedding: "nomic-embed-text",
  },
  groq: {
    base_url: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
    embedding: "text-embedding-3-small",
  },
  openai: {
    base_url: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o"],
    embedding: "text-embedding-3-small",
  },
  google: {
    base_url: "https://generativelanguage.googleapis.com",
    models: ["gemini-2.0-flash", "gemini-1.5-flash"],
    embedding: "text-embedding-004",
  },
  mistral: {
    base_url: "https://api.mistral.ai/v1",
    models: ["mistral-small-latest", "mistral-large-latest"],
    embedding: "text-embedding-3-small",
  },
  deepseek: {
    base_url: "https://api.deepseek.com/v1",
    models: ["deepseek-chat"],
    embedding: "text-embedding-3-small",
  },
  custom: {
    base_url: "https://api.example.com/v1",
    models: ["model-name"],
    embedding: "text-embedding-3-small",
  },
};

type ConfigRow = {
  id: string;
  provider: AiProvider;
  base_url: string;
  model_name: string;
  embedding_model: string | null;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  tenantId: string;
  onSaved?: () => void;
};

export function AIConfigTab({ tenantId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [baseUrl, setBaseUrl] = useState(PRESETS.openai.base_url);
  const [modelName, setModelName] = useState(PRESETS.openai.models[0]);
  const [embeddingModel, setEmbeddingModel] = useState(PRESETS.openai.embedding);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.7);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invokeAiTenant<{ configs: ConfigRow[] }>({
        action: "list-ai-configs",
        tenant_id: tenantId,
      });
      setConfigs(res.configs ?? []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Konfigurationen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (p: AiProvider) => {
    setProvider(p);
    setBaseUrl(PRESETS[p].base_url);
    setModelName(PRESETS[p].models[0]);
    setEmbeddingModel(PRESETS[p].embedding);
  };

  const selectExisting = (id: string) => {
    const c = configs.find((x) => x.id === id);
    if (!c) return;
    setSelectedId(id);
    setProvider(c.provider as AiProvider);
    setBaseUrl(c.base_url);
    setModelName(c.model_name);
    setEmbeddingModel(c.embedding_model || PRESETS[c.provider as AiProvider]?.embedding || "");
    setMaxTokens(c.max_tokens);
    setTemperature(c.temperature);
    setIsActive(c.is_active);
    setApiKey("");
  };

  const resetNew = () => {
    setSelectedId("new");
    applyPreset("openai");
    setApiKey("");
    setIsActive(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: "save-ai-config",
        tenant_id: tenantId,
        provider,
        base_url: baseUrl,
        model_name: modelName,
        embedding_model: embeddingModel || null,
        max_tokens: maxTokens,
        temperature,
        is_active: isActive,
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      if (selectedId !== "new") payload.id = selectedId;

      await invokeAiTenant(payload);
      toast.success("KI-Konfiguration gespeichert");
      setApiKey("");
      await load();
      onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const testConn = async () => {
    setTesting(true);
    try {
      const cfg: Record<string, unknown> = {
        provider,
        base_url: baseUrl,
        model_name: modelName,
        embedding_model: embeddingModel || null,
        max_tokens: Math.min(maxTokens, 512),
        temperature,
      };
      if (apiKey.trim()) cfg.api_key = apiKey.trim();
      if (selectedId !== "new") cfg.id = selectedId;

      const res = await invokeAiTenant<{ reply: string }>({
        action: "test-connection",
        tenant_id: tenantId,
        config: cfg,
      });
      toast.success("Antwort der KI", { description: res.reply?.slice(0, 240) });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Test fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Diese Konfiguration wirklich löschen?")) return;
    try {
      await invokeAiTenant({ action: "delete-ai-config", tenant_id: tenantId, id });
      toast.success("Gelöscht");
      if (selectedId === id) resetNew();
      await load();
      onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    }
  };

  if (loading) {
    return (
      <AdminCard className="p-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </AdminCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <AdminCard title="Gespeicherte Profile" padding="sm">
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={resetNew}>
            + Neues Profil
          </Button>
          {configs.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between rounded-lg border p-2 text-sm cursor-pointer ${
                selectedId === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => selectExisting(c.id)}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{c.provider}</div>
                <div className="text-[10px] text-muted-foreground truncate">{c.model_name}</div>
                {c.is_active && <span className="text-[10px] text-green-600 font-bold">AKTIV</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(c.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {configs.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Einträge.</p>}
        </div>
      </AdminCard>

      <AdminCard title="KI-Anbieter" padding="md">
        <div className="grid gap-6 max-w-2xl">
          <AdminFieldGroup label="Provider" description="Voreinstellungen für Basis-URL und Modell">
            <Select
              value={provider}
              onValueChange={(v) => applyPreset(v as AiProvider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama (lokal)</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="google">Google AI Studio</SelectItem>
                <SelectItem value="mistral">Mistral</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="custom">Benutzerdefiniert (OpenAI-kompatibel)</SelectItem>
              </SelectContent>
            </Select>
          </AdminFieldGroup>

          <AdminFieldGroup label="Basis-URL" description="Vollständige API-Basis inkl. /v1 wo nötig">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="font-mono text-xs" />
          </AdminFieldGroup>

          <AdminFieldGroup label="Chat-Modell" description="Vorschläge je nach Provider">
            <div className="flex gap-2 flex-wrap">
              {PRESETS[provider].models.map((m) => (
                <Button key={m} type="button" variant={modelName === m ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setModelName(m)}>
                  {m}
                </Button>
              ))}
            </div>
            <Input value={modelName} onChange={(e) => setModelName(e.target.value)} className="font-mono text-xs mt-2" />
          </AdminFieldGroup>

          <AdminFieldGroup label="Embedding-Modell" description="Für RAG / Ähnlichkeit (768 Dimensionen)">
            <Input value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)} className="font-mono text-xs" />
          </AdminFieldGroup>

          <AdminFieldGroup label="API-Key" description="Leer lassen bei Ollama ohne Auth; wird serverseitig verschlüsselt (TENANT_AI_CRYPTO_KEY)">
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedId === "new" ? "Neuer Key" : "Unverändert lassen oder neuen Key eintragen"}
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </AdminFieldGroup>

          <div className="grid sm:grid-cols-2 gap-4">
            <AdminFieldGroup label={`Max. Token (${maxTokens})`}>
              <Input type="number" min={256} max={128000} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value) || 4096)} />
            </AdminFieldGroup>
            <AdminFieldGroup label={`Temperatur (${temperature.toFixed(2)})`}>
              <Slider value={[temperature]} min={0} max={1.5} step={0.05} onValueChange={(v) => setTemperature(v[0] ?? 0.7)} />
            </AdminFieldGroup>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch id="ai-active" checked={isActive} onCheckedChange={(v) => setIsActive(!!v)} />
            <Label htmlFor="ai-active" className="cursor-pointer">
              Als aktive Mandanten-KI speichern (andere Profile werden deaktiviert)
            </Label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Speichern
            </Button>
            <Button type="button" variant="secondary" onClick={() => void testConn()} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plug className="h-4 w-4 mr-2" />}
              Test-Verbindung
            </Button>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
