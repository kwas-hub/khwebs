import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Field = {
  id: string; field_type: "text" | "number" | "email" | "textarea" | "radio" | "checkbox" | "html";
  label: string; field_name: string; options: string[]; html_content: string; required: boolean; placeholder: string;
};
type Form = { id: string; title: string; description: string; submit_label: string; success_message: string };

const PublishedForms = () => {
  const [forms, setForms] = useState<(Form & { fields: Field[] })[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, any>>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const load = async () => {
    const { data: fs } = await supabase.from("forms").select("*").eq("published", true).order("position");
    if (!fs?.length) { setForms([]); return; }
    const ids = fs.map((f: any) => f.id);
    const { data: ff } = await supabase.from("form_fields").select("*").in("form_id", ids).order("position");
    setForms(fs.map((f: any) => ({
      ...f,
      fields: (ff ?? []).filter((x: any) => x.form_id === f.id).map((x: any) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })),
    })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("pub-forms")
      .on("postgres_changes", { event: "*", schema: "public", table: "forms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "form_fields" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setVal = (formId: string, name: string, v: any) => {
    setValues((p) => ({ ...p, [formId]: { ...(p[formId] || {}), [name]: v } }));
  };

  const submit = async (form: Form & { fields: Field[] }) => {
    const data = values[form.id] || {};
    for (const f of form.fields) {
      if (f.field_type === "html") continue;
      if (f.required && (data[f.field_name] === undefined || data[f.field_name] === "" || (Array.isArray(data[f.field_name]) && !data[f.field_name].length))) {
        toast.error(`Bitte ausfüllen: ${f.label}`);
        return;
      }
    }
    setLoading((p) => ({ ...p, [form.id]: true }));
    const { error } = await supabase.from("form_submissions").insert({ form_id: form.id, data });
    setLoading((p) => ({ ...p, [form.id]: false }));
    if (error) { toast.error(error.message); return; }
    setSubmitted((p) => ({ ...p, [form.id]: true }));
    setValues((p) => ({ ...p, [form.id]: {} }));
  };

  if (!forms.length) return null;

  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-3xl space-y-12">
        {forms.map((form) => (
          <div key={form.id}>
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-3xl md:text-4xl font-bold">{form.title}</h2>
              {form.description && <p className="text-muted-foreground whitespace-pre-line">{form.description}</p>}
            </div>
            <Card className="p-6">
              {submitted[form.id] ? (
                <p className="text-center text-primary py-6">✓ {form.success_message}</p>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); submit(form); }} className="space-y-4">
                  {form.fields.map((f) => {
                    const v = values[form.id]?.[f.field_name];
                    if (f.field_type === "html") {
                      return <div key={f.id} dangerouslySetInnerHTML={{ __html: f.html_content }} />;
                    }
                    if (f.field_type === "textarea") {
                      return (
                        <div key={f.id}>
                          <Label>{f.label}{f.required && " *"}</Label>
                          <Textarea required={f.required} placeholder={f.placeholder} value={v ?? ""} onChange={(e) => setVal(form.id, f.field_name, e.target.value)} />
                        </div>
                      );
                    }
                    if (f.field_type === "radio") {
                      return (
                        <div key={f.id}>
                          <Label>{f.label}{f.required && " *"}</Label>
                          <div className="space-y-1 mt-1">
                            {f.options.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-sm">
                                <input type="radio" name={`${form.id}_${f.field_name}`} value={opt} checked={v === opt} onChange={() => setVal(form.id, f.field_name, opt)} required={f.required} />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (f.field_type === "checkbox") {
                      const arr: string[] = Array.isArray(v) ? v : [];
                      return (
                        <div key={f.id}>
                          <Label>{f.label}{f.required && " *"}</Label>
                          <div className="space-y-1 mt-1">
                            {f.options.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={arr.includes(opt)} onChange={(e) => {
                                  const next = e.target.checked ? [...arr, opt] : arr.filter((x) => x !== opt);
                                  setVal(form.id, f.field_name, next);
                                }} />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={f.id}>
                        <Label>{f.label}{f.required && " *"}</Label>
                        <Input type={f.field_type} required={f.required} placeholder={f.placeholder} value={v ?? ""} onChange={(e) => setVal(form.id, f.field_name, e.target.value)} />
                      </div>
                    );
                  })}
                  <Button type="submit" disabled={loading[form.id]} className="w-full">
                    {loading[form.id] ? "Wird gesendet..." : form.submit_label}
                  </Button>
                </form>
              )}
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
};

export default PublishedForms;
