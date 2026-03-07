import { motion } from "framer-motion";
import { MessageCircle, ArrowRight, Send } from "lucide-react";
import { useState } from "react";

const ContactSection = () => {
  const [form, setForm] = useState({ firstName: "", lastName: "",email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const whatsappNumber = "4915679715277";
  const whatsappUrl = `https://wa.me/${whatsappNumber}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          subject: form.subject,
          message: form.message,
        }),
      });

      // --- SICHERUNG: Antwort zuerst als Text lesen ---
      const responseText = await response.text();
      console.log("Server Rohantwort:", responseText);

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("JSON Parse Fehler:", parseError);
        throw new Error("Der Server hat keine gültige JSON-Antwort gesendet.");
      }
      // -----------------------------------------------

      if (!response.ok) {
        throw new Error(data.error || `Server-Fehler: ${response.status}`);
      }

      setSent(true);
      setForm({ firstName: "", lastName: "", email: "", subject: "", message: "" });
      setTimeout(() => setSent(false), 4000);
    } catch (err: any) {
      console.error("Detaillierter Fehler beim Senden:", err);
      setError(err.message || "Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="kontakt" className="relative border-t border-border py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(185_80%_55%/0.05)_0%,transparent_60%)]" />
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">KONTAKT</p>
          <h2 className="mb-6 text-3xl font-bold md:text-5xl">
            Bereit, Ihr Business <span className="text-gradient">voranzubringen</span>?
          </h2>
          <p className="mb-12 text-lg text-muted-foreground">
            Lassen Sie uns in einem Erstgespräch herausfinden,
            wie ich Ihre Prozesse transformieren kann.
          </p>

          <div className="mx-auto max-w-md space-y-6">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-3 rounded-md bg-primary px-8 py-4 font-medium text-primary-foreground transition-all hover:shadow-[0_0_30px_hsl(185_80%_55%/0.4)]"
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp Nachricht senden
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm text-muted-foreground">oder per Formular</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Vorname</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Max"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Nachname</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Mustermann"
                  />
                </div>
              </div>
              <div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">E-Mail Adresse</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Max.Mustermann@mail.de"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Thema</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Digitalisierung, Automatisierung, ..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Nachricht</label>
                <textarea
                  required
                  maxLength={2000}
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full resize-none rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Beschreiben Sie kurz Ihr Anliegen..."
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="group flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-transparent px-8 py-3 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Wird gesendet..." : "Nachricht senden"}
              </button>
              {sent && (
                <p className="text-center text-sm text-primary">
                  ✓ Nachricht erfolgreich gesendet. Vielen Dank!
                </p>
              )}
              {error && (
                <p className="text-center text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;