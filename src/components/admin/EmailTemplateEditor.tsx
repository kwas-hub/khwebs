import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";

type Tpl = { id?: string; subject: string; body: string; is_html: boolean };

interface Props {
  triggerKey: string;
  title: string;
  description?: string;
  variableHints?: string[];
  defaultSubject?: string;
  defaultBody?: string;
  disabled?: boolean;
}

export const EmailTemplateEditor = ({
  triggerKey, title, description, variableHints = [], defaultSubject = "", defaultBody = "", disabled,
}: Props) => {
  const [tpl, setTpl] = useState<Tpl>({ subject: defaultSubject, body: defaultBody, is_html: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("email_templates")
        .select("id, subject, body, is_html")
        .eq("trigger_key", triggerKey)
        .maybeSingle();
      if (data) setTpl(data as Tpl);
      else setTpl({ subject: defaultSubject, body: defaultBody, is_html: false });
      setLoading(false);
    };
    load();
  }, [triggerKey]);

  const save = async () => {
    setSaving(true);
    const payload = { trigger_key: triggerKey, subject: tpl.subject, body: tpl.body, is_html: tpl.is_html };
    const { error } = await supabase
      .from("email_templates")
      .upsert(payload, { onConflict: "trigger_key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Vorlage gespeichert");
  };

  return (
    <Card className="p-5 space-y-4 border-border bg-card">
      <div>
        <h3 className="font-bold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      {variableHints.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          Variablen: {variableHints.map((v) => <code key={v} className="bg-muted px-1 mx-0.5 rounded">{`{{${v}}}`}</code>)}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase font-bold">Betreff</Label>
        <Input value={tpl.subject} disabled={disabled || loading} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase font-bold">Nachricht {tpl.is_html ? "(HTML)" : "(Text)"}</Label>
          <div className="flex items-center gap-2">
            <Label className="text-xs">HTML-Modus</Label>
            <Switch checked={tpl.is_html} disabled={disabled} onCheckedChange={(v) => setTpl({ ...tpl, is_html: v })} />
          </div>
        </div>
        <Textarea
          rows={tpl.is_html ? 14 : 10}
          className={tpl.is_html ? "font-mono text-xs" : ""}
          value={tpl.body}
          disabled={disabled || loading}
          onChange={(e) => setTpl({ ...tpl, body: e.target.value })}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={disabled || saving || loading}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Speichert..." : "Speichern"}
        </Button>
      </div>
    </Card>
  );
};
