import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  Sparkles, 
  FileText, 
  Calendar, 
  Newspaper, 
  Bot,
  Shield,
  Zap,
  Users,
  ArrowRight,
  Star,
  Mail,
  Phone,
  MapPin,
  Send,
  Github,
  Twitter,
  Linkedin,
  MessageSquare,
  Upload,
  Scissors,
  Eye,
  Settings
} from "lucide-react";
import { useState } from "react";

// ============================================
// HERO SECTION
// ============================================
const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="mr-1.5 h-3 w-3" />
              All-in-One Verwaltungsplattform
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Alles aus einer
              <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Hand
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Formulare, Termine, News, Dokumentenmanagement mit KI-gestützter OCR – 
              alles in einer modernen, mandantenfähigen Plattform.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105">
                Kostenlos testen
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button className="inline-flex items-center justify-center rounded-full border border-border bg-background px-6 py-3 font-semibold transition-all hover:bg-muted">
                Demo ansehen
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50">
              <img
                src="https://picsum.photos/id/0/600/500"
                alt="Dashboard Vorschau"
                className="w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-xl bg-background/90 backdrop-blur-sm p-4 shadow-lg border border-border/50">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">KI-gestützte OCR</div>
                  <div className="text-xs text-muted-foreground">Dokumente automatisch erfassen</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// FEATURES - DAS SYSTEM IM DETAIL
// ============================================
const systemFeatures = [
  { 
    icon: FileText, 
    title: "Dynamische Formulare", 
    desc: "Erstellen Sie beliebige Formulare mit Drag & Drop. Inkl. E-Mail-Benachrichtigungen und Statusverwaltung.",
    image: "https://picsum.photos/id/26/400/300",
    tags: ["Drag & Drop", "E-Mail Templates", "Status-Tracking"]
  },
  { 
    icon: Calendar, 
    title: "Terminverwaltung", 
    desc: "Termine erfassen, zuweisen und verwalten. Mit Kalenderansicht und automatischen Erinnerungen.",
    image: "https://picsum.photos/id/29/400/300",
    tags: ["Kalender", "Aufgaben", "Erinnerungen"]
  },
  { 
    icon: Newspaper, 
    title: "News & Content", 
    desc: "Verwalten Sie News-Bereiche mit HTML-Editor, Veröffentlichungsstatus und Positionierung.",
    image: "https://picsum.photos/id/20/400/300",
    tags: ["HTML-Editor", "Veröffentlichung", "Sortierung"]
  },
  { 
    icon: Bot, 
    title: "KI-Dokumentenanalyse", 
    desc: "PDFs hochladen, OCR durchführen, Dokumente klassifizieren und Stammdaten extrahieren.",
    image: "https://picsum.photos/id/24/400/300",
    tags: ["OCR", "Klassifikation", "Extraktion"]
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">FUNKTIONEN</p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Alles, was Sie <span className="text-gradient">brauchen</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Eine Plattform – alle Tools. Von Formularen bis zur KI-gestützten Dokumentenverarbeitung.
          </p>
        </motion.div>

        <div className="space-y-24">
          {systemFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`grid items-center gap-12 md:grid-cols-2 ${i % 2 === 1 ? 'md:grid-flow-dense' : ''}`}
            >
              <div className={i % 2 === 1 ? 'md:col-start-2' : ''}>
                <div className="inline-flex rounded-xl bg-primary/10 p-3 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold md:text-3xl">{feature.title}</h3>
                <p className="mt-4 text-muted-foreground">{feature.desc}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {feature.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`relative rounded-2xl overflow-hidden shadow-xl border border-border/50 ${i % 2 === 1 ? 'md:col-start-1' : ''}`}>
                <img src={feature.image} alt={feature.title} className="w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// KI/OCR HIGHLIGHTS
// ============================================
const ocrHighlights = [
  { icon: Upload, title: "PDF hochladen", desc: "Drag & Drop oder klassischer Upload" },
  { icon: Eye, title: "Seiten bearbeiten", desc: "Drehen, löschen, sortieren" },
  { icon: Sparkles, title: "OCR durchführen", desc: "Texte automatisch erkennen" },
  { icon: Scissors, title: "Dokumente trennen", desc: "Intelligente Split-Erkennung" },
  { icon: Settings, title: "Dokumenttypen", desc: "Mit Schlagwörtern klassifizieren" },
  { icon: Bot, title: "KI-Extraktion", desc: "Rechnungsdaten automatisch auslesen" },
];

const OcrSection = () => {
  return (
    <section className="bg-muted/30 py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">KI & OCR</p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Intelligente <span className="text-gradient">Dokumentenverarbeitung</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Mit unserer KI-gestützten OCR erkennen und klassifizieren Sie Dokumente automatisch.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
          {ocrHighlights.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="text-center"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-sm font-semibold">{item.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 rounded-2xl border border-border/50 bg-card p-6 text-center"
        >
          <p className="text-sm text-muted-foreground">
            ✨ Neu: Konfigurierbare KI-Provider (OpenAI, Groq, Ollama, Google, Mistral, DeepSeek)
          </p>
        </motion.div>
      </div>
    </section>
  );
};

// ============================================
// PROZESS SECTION (dein bestehender Code)
// ============================================
const steps = [
  { num: "01", title: "Analyse", desc: "Bestandsaufnahme Ihrer aktuellen Prozesse, Systeme und Ziele." },
  { num: "02", title: "Konzept", desc: "Maßgeschneiderte Strategie mit klaren Meilensteinen und ROI-Prognose." },
  { num: "03", title: "Umsetzung", desc: "Agile Implementierung mit regelmäßigen Updates und Abstimmungen." },
  { num: "04", title: "Support", desc: "Nachhaltige Betreuung, Schulung und kontinuierliche Optimierung." },
];

const ProcessSection = () => {
  return (
    <section id="prozess" className="border-t border-border py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">ABLAUF</p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Vom Problem zur <span className="text-gradient">Lösung</span>
          </h2>
        </motion.div>

        <div className="grid gap-0 md:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative border-l border-border p-8 md:border-l-0 md:border-t"
            >
              <div className="absolute -left-px top-0 h-3 w-px bg-primary md:-top-px md:left-0 md:h-px md:w-3" />
              <span className="mb-4 block font-mono text-3xl font-bold text-primary/30">{step.num}</span>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// KONTAKT & NEWS (wie gewünscht)
// ============================================
const ContactForm = () => {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    alert("Vielen Dank! Wir werden uns bei Ihnen melden.");
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Name *</label>
        <input
          type="text"
          required
          className="w-full rounded-lg border border-border bg-background px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">E-Mail *</label>
        <input
          type="email"
          required
          className="w-full rounded-lg border border-border bg-background px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Nachricht *</label>
        <textarea
          required
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        />
      </div>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
      >
        Nachricht senden
        <Send className="ml-2 h-4 w-4" />
      </button>
    </form>
  );
};

const newsItems = [
  { id: 1, title: "Neue KI-Funktionen verfügbar", date: "15.05.2024", excerpt: "Dokumentenklassifikation und Stammdatenextraktion jetzt mit konfigurierbaren KI-Providern." },
  { id: 2, title: "Mandantenfähigkeit released", date: "10.05.2024", excerpt: "Unterstützung für mehrere Mandanten mit vollständiger Isolation der Daten." },
  { id: 3, title: "OCR-Verbesserungen", date: "05.05.2024", excerpt: "Bessere Texterkennung und Unterstützung für verschiedene Dokumententypen." },
];

const forms = [
  { id: 1, title: "Kontaktanfrage", description: "Allgemeine Anfragen an unser Team", submissions: 24 },
  { id: 2, title: "Support-Ticket", description: "Technischer Support und Hilfe", submissions: 18 },
  { id: 3, title: "Demo anfordern", description: "Vereinbaren Sie eine persönliche Demo", submissions: 12 },
];

const ContactAndNewsSection = () => {
  return (
    <section className="border-t border-border py-32 bg-muted/10">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">KONTAKT & AKTUELLES</p>
          <h2 className="text-3xl font-bold md:text-4xl">
            Lassen Sie uns <span className="text-gradient">sprechen</span>
          </h2>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border/50 bg-card p-6"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Kontaktformular</h3>
            </div>
            <ContactForm />
            
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>+49 (0) 123 456789</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>info@ihre-firma.de</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Musterstraße 123, 12345 Berlin</span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Aktuelle News</h3>
              </div>
              <div className="space-y-4">
                {newsItems.map((news) => (
                  <div key={news.id} className="border-b border-border/50 pb-3 last:border-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{news.date}</span>
                    </div>
                    <h4 className="font-semibold mt-1">{news.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{news.excerpt}</p>
                    <button className="mt-2 text-sm text-primary hover:underline">Mehr lesen →</button>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Unsere Formulare</h3>
              </div>
              <div className="space-y-3">
                {forms.map((form) => (
                  <div key={form.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0">
                    <div>
                      <h4 className="font-medium">{form.title}</h4>
                      <p className="text-xs text-muted-foreground">{form.description}</p>
                    </div>
                    <button className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20">
                      Öffnen
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// FOOTER
// ============================================
const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">khwebs</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Ihre Plattform für Formulare, Termine, News und KI-gestützte Dokumentenverarbeitung.
            </p>
            <div className="mt-4 flex gap-3">
              <Github className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
              <Twitter className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
              <Linkedin className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
            </div>
          </div>
          <div>
            <h4 className="mb-3 font-semibold">Produkte</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Formulare</a></li>
              <li><a href="#" className="hover:text-foreground">Termine</a></li>
              <li><a href="#" className="hover:text-foreground">News</a></li>
              <li><a href="#" className="hover:text-foreground">KI / OCR</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold">Unternehmen</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Über uns</a></li>
              <li><a href="#" className="hover:text-foreground">Karriere</a></li>
              <li><a href="#" className="hover:text-foreground">Blog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold">Rechtliches</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Datenschutz</a></li>
              <li><a href="#" className="hover:text-foreground">Impressum</a></li>
              <li><a href="#" className="hover:text-foreground">AGB</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
          &copy; 2024 khwebs. Alle Rechte vorbehalten.
        </div>
      </div>
    </footer>
  );
};

// ============================================
// MAIN PAGE
// ============================================
const MarketingLandingPage = () => {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <FeaturesSection />
      <OcrSection />
      <ProcessSection />
      <ContactAndNewsSection />
      <Footer />
    </main>
  );
};

export default MarketingLandingPage;
