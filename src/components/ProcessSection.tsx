import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  Sparkles, 
  BarChart3, 
  Users, 
  Shield, 
  Zap, 
  Clock, 
  Award,
  ArrowRight,
  Star,
  Mail,
  Phone,
  MapPin,
  Send,
  Github,
  Twitter,
  Linkedin,
  FileText,
  Calendar,
  MessageSquare
} from "lucide-react";
import { useState } from "react";

// ============================================
// HERO SECTION
// ============================================
const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Hintergrund-Effekte */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Linke Seite: Text */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="mr-1.5 h-3 w-3" />
              Digitale Exzellenz für Ihre Marke
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Wir bringen Ihre
              <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Ideen zum Fliegen
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Maßgeschneiderte Softwarelösungen für anspruchsvolle Unternehmen.
              Von der Strategie bis zur Umsetzung – wir begleiten Sie auf Ihrem
              Weg zur digitalen Spitze.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105">
                Kostenloses Beratungsgespräch
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button className="inline-flex items-center justify-center rounded-full border border-border bg-background px-6 py-3 font-semibold transition-all hover:bg-muted">
                Referenzen ansehen
              </button>
            </div>
            <div className="mt-8 flex items-center gap-6">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br from-primary/60 to-primary/20" />
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">250+</span> zufriedene Kunden
              </div>
            </div>
          </motion.div>

          {/* Rechte Seite: Bild */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://picsum.photos/id/20/600/500"
                alt="Team arbeitet an Software"
                className="w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            {/* Floating Card */}
            <div className="absolute -bottom-6 -left-6 rounded-xl bg-background/90 backdrop-blur-sm p-4 shadow-lg border border-border/50">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">100% Kundenzufriedenheit</div>
                  <div className="text-xs text-muted-foreground">Basierend auf 50+ Bewertungen</div>
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
// LOGO CLOUD / KUNDEN
// ============================================
const LogoCloud = () => {
  const logos = [
    "Company 1", "Company 2", "Company 3", "Company 4", "Company 5", "Company 6"
  ];
  return (
    <section className="border-y border-border/50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Vertrauen von führenden Unternehmen
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {logos.map((logo, i) => (
            <div key={i} className="text-2xl font-bold text-muted-foreground/50 transition-all hover:text-muted-foreground">
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// FEATURES GRID
// ============================================
const features = [
  { icon: Zap, title: "Blitzschnell", desc: "Optimierte Performance für beste User Experience", color: "from-yellow-500 to-orange-500" },
  { icon: Shield, title: "Sicher", desc: "Datenschutz und Sicherheit auf höchstem Niveau", color: "from-blue-500 to-cyan-500" },
  { icon: BarChart3, title: "Skalierbar", desc: "Wächst mit Ihren Anforderungen", color: "from-green-500 to-emerald-500" },
  { icon: Users, title: "Benutzerfreundlich", desc: "Intuitive Bedienung für alle Nutzer", color: "from-purple-500 to-pink-500" },
  { icon: Clock, title: "24/7 Support", desc: "Rund um die Uhr für Sie da", color: "from-red-500 to-rose-500" },
  { icon: Award, title: "Ausgezeichnet", desc: "Preisgekrönte Lösungen", color: "from-indigo-500 to-violet-500" },
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
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">WARUM WIR</p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Das zeichnet uns <span className="text-gradient">aus</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Wir kombinieren modernste Technologie mit jahrelanger Erfahrung, um Ihnen die besten Lösungen zu bieten.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${feature.color} p-3`}>
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// PROZESS SECTION (aus deinem Code)
// ============================================
const steps = [
  { num: "01", title: "Analyse", desc: "Bestandsaufnahme Ihrer aktuellen Prozesse, Systeme und Ziele." },
  { num: "02", title: "Konzept", desc: "Maßgeschneiderte Strategie mit klaren Meilensteinen und ROI-Prognose." },
  { num: "03", title: "Umsetzung", desc: "Agile Implementierung mit regelmäßigen Updates und Abstimmungen." },
  { num: "04", title: "Support", desc: "Nachhaltige Betreuung, Schulung und kontinuierliche Optimierung." },
];

const ProcessSection = () => {
  return (
    <section id="prozess" className="border-t border-border py-32 bg-muted/30">
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
// TESTIMONIALS / REFERENZEN
// ============================================
const testimonials = [
  { name: "Anna Schmidt", role: "CEO, TechCorp", text: "Die Zusammenarbeit war hervorragend. Die Lösung hat unsere Erwartungen übertroffen.", rating: 5 },
  { name: "Michael Weber", role: "CTO, Innovate GmbH", text: "Professionelle Beratung und exzellente Umsetzung. Absolute Weiterempfehlung!", rating: 5 },
  { name: "Sarah Meyer", role: "Head of Digital", text: "Die Plattform hat unsere Prozesse revolutioniert. Vielen Dank an das gesamte Team.", rating: 5 },
];

const TestimonialsSection = () => {
  return (
    <section className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">REFERENZEN</p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Was unsere <span className="text-gradient">Kunden sagen</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                ))}
              </div>
              <p className="mb-4 text-muted-foreground">"{t.text}"</p>
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// KONTAKTFORMULAR + NEWS + FORMULARE (Dein bestehender Bereich)
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

// Demo News Items
const newsItems = [
  { id: 1, title: "Neue Funktion: KI-gestützte Dokumentenanalyse", date: "15.05.2024", excerpt: "Unsere neue KI-Funktion revolutioniert die Art, wie Sie Dokumente verwalten." },
  { id: 2, title: "Ausgezeichnet als bester Softwarepartner 2024", date: "10.05.2024", excerpt: "Wir freuen uns über die Auszeichnung als bester Softwarepartner im Mittelstand." },
  { id: 3, title: "Webinar: Digitale Transformation", date: "05.05.2024", excerpt: "Nehmen Sie an unserem kostenlosen Webinar teil und lernen Sie die neuesten Trends kennen." },
];

// Demo Formulare
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
          {/* Linke Spalte: Kontaktformular */}
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

          {/* Rechte Spalte: News + Formulare */}
          <div className="space-y-6">
            {/* News Bereich */}
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

            {/* Dynamische Formulare */}
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
              <span className="text-lg font-bold">Brand</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Moderne Softwarelösungen für anspruchsvolle Unternehmen.
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
              <li><a href="#" className="hover:text-foreground">Übersicht</a></li>
              <li><a href="#" className="hover:text-foreground">Features</a></li>
              <li><a href="#" className="hover:text-foreground">Preise</a></li>
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
          &copy; 2024 Brand. Alle Rechte vorbehalten.
        </div>
      </div>
    </footer>
  );
};

// ============================================
// MAIN PAGE KOMPONENTE
// ============================================
const MarketingLandingPage = () => {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <LogoCloud />
      <FeaturesSection />
      <ProcessSection />
      <TestimonialsSection />
      <ContactAndNewsSection />
      <Footer />
    </main>
  );
};

export default MarketingLandingPage;
