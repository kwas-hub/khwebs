import { motion } from "framer-motion";

const steps = [
  { num: "01", title: "Analyse", desc: "Bestandsaufnahme Ihrer aktuellen Prozesse, Systeme und Ziele." },
  { num: "02", title: "Konzept", desc: "Maßgeschneiderte Strategie mit klaren Meilensteinen und ROI-Prognose." },
  { num: "03", title: "Umsetzung", desc: "Agile Implementierung mit regelmäßigen Updates und Abstimmungen." },
  { num: "04", title: "Support", desc: "Nachhaltige Betreuung, Schulung und kontinuierliche Optimierung." },
];

const ProcessSection = () => {
  return (
    <section id="prozess" className="relative border-t border-border py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
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

export default ProcessSection;









const FeaturesSection = () => {
  const features = [
    { title: "KI-gestützte Dokumentenanalyse", description: "Automatische Klassifizierung und Extraktion von Stammdaten aus PDFs.", icon: "🤖" },
    { title: "Mandantenfähig", description: "Getrennte Datenräume für verschiedene Kunden oder Abteilungen.", icon: "🏢" },
    { title: "OCR & Texterkennung", description: "Erkennen und korrigieren von Text in gescannten Dokumenten.", icon: "📄" },
    { title: "RAG-Chat", description: "Stellen Sie Fragen zu Ihren Dokumenten – die KI antwortet.", icon: "💬" },
    { title: "Dokumententrennung", description: "Automatische Aufteilung von PDFs an logischen Stellen.", icon: "✂️" },
    { title: "API-Schnittstelle", description: "Integration in bestehende Systeme über REST-API.", icon: "🔌" },
  ];

  return (
    <section className="py-20 px-4 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-4">Leistungen im Überblick</h2>
      <p className="text-center text-muted-foreground mb-12">Alles, was Sie für moderne Dokumentenverwaltung brauchen</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div key={i} className="p-6 border rounded-xl bg-card hover:shadow-lg transition-all">
            <div className="text-4xl mb-4">{f.icon}</div>
            <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
            <p className="text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
export default FeaturesSection;
const UseCasesSection = () => {
  const useCases = [
    { title: "Rechnungseingang", description: "Automatische Extraktion von Rechnungsdaten und Prüfung auf Abweichungen." },
    { title: "Vertragsmanagement", description: "Klassifizierung, Zusammenfassung und intelligente Suche in Verträgen." },
    { title: "Kundenkommunikation", description: "Formulareingaben automatisch verarbeiten und bestätigen." },
    { title: "Archivierung", description: "Alte PDFs durchsuchen, verschlagworten und organisieren." },
  ];

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Einsatzbereiche</h2>
        <p className="text-center text-muted-foreground mb-12">Für wen sich unsere Software lohnt</p>
        <div className="grid md:grid-cols-2 gap-6">
          {useCases.map((u, i) => (
            <div key={i} className="p-6 border rounded-xl bg-card">
              <h3 className="text-xl font-semibold mb-2">{u.title}</h3>
              <p className="text-muted-foreground">{u.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default UseCasesSection;
const PricingSection = () => {
  return (
    <section className="py-20 px-4 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-4">Einfache & transparente Preise</h2>
      <p className="text-center text-muted-foreground mb-12">Für jedes Unternehmen die passende Lösung</p>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-xl bg-card text-center">
          <h3 className="text-xl font-bold mb-2">Starter</h3>
          <p className="text-3xl font-bold mb-4">99€<span className="text-sm font-normal">/Monat</span></p>
          <ul className="text-sm text-left space-y-2 mb-6">
            <li>✓ Bis zu 500 Dokumente/Monat</li>
            <li>✓ Grundlegende KI-Funktionen</li>
            <li>✓ 1 Benutzer</li>
          </ul>
          <button className="w-full py-2 px-4 bg-primary text-white rounded-lg">Starten</button>
        </div>
        <div className="p-6 border-2 border-primary rounded-xl bg-primary/5 text-center">
          <h3 className="text-xl font-bold mb-2">Professional</h3>
          <p className="text-3xl font-bold mb-4">249€<span className="text-sm font-normal">/Monat</span></p>
          <ul className="text-sm text-left space-y-2 mb-6">
            <li>✓ Unbegrenzte Dokumente</li>
            <li>✓ Alle KI-Funktionen</li>
            <li>✓ Bis zu 10 Benutzer</li>
            <li>✓ API-Zugang</li>
          </ul>
          <button className="w-full py-2 px-4 bg-primary text-white rounded-lg">Jetzt testen</button>
        </div>
        <div className="p-6 border rounded-xl bg-card text-center">
          <h3 className="text-xl font-bold mb-2">Enterprise</h3>
          <p className="text-3xl font-bold mb-4">Individuell</p>
          <ul className="text-sm text-left space-y-2 mb-6">
            <li>✓ Individuelle KI-Modelle</li>
            <li>✓ On-Premise möglich</li>
            <li>✓ Support 24/7</li>
          </ul>
          <button className="w-full py-2 px-4 bg-primary text-white rounded-lg">Kontakt</button>
        </div>
      </div>
    </section>
  );
};
export default PricingSection;
const PricingSection = () => {
  return (
    <section className="py-20 px-4 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-4">Einfache & transparente Preise</h2>
      <p className="text-center text-muted-foreground mb-12">Für jedes Unternehmen die passende Lösung</p>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-xl bg-card text-center">
          <h3 className="text-xl font-bold mb-2">Starter</h3>
          <p className="text-3xl font-bold mb-4">99€<span className="text-sm font-normal">/Monat</span></p>
          <ul className="text-sm text-left space-y-2 mb-6">
            <li>✓ Bis zu 500 Dokumente/Monat</li>
            <li>✓ Grundlegende KI-Funktionen</li>
            <li>✓ 1 Benutzer</li>
          </ul>
          <button className="w-full py-2 px-4 bg-primary text-white rounded-lg">Starten</button>
        </div>
        <div className="p-6 border-2 border-primary rounded-xl bg-primary/5 text-center">
          <h3 className="text-xl font-bold mb-2">Professional</h3>
          <p className="text-3xl font-bold mb-4">249€<span className="text-sm font-normal">/Monat</span></p>
          <ul className="text-sm text-left space-y-2 mb-6">
            <li>✓ Unbegrenzte Dokumente</li>
            <li>✓ Alle KI-Funktionen</li>
            <li>✓ Bis zu 10 Benutzer</li>
            <li>✓ API-Zugang</li>
          </ul>
          <button className="w-full py-2 px-4 bg-primary text-white rounded-lg">Jetzt testen</button>
        </div>
        <div className="p-6 border rounded-xl bg-card text-center">
          <h3 className="text-xl font-bold mb-2">Enterprise</h3>
          <p className="text-3xl font-bold mb-4">Individuell</p>
          <ul className="text-sm text-left space-y-2 mb-6">
            <li>✓ Individuelle KI-Modelle</li>
            <li>✓ On-Premise möglich</li>
            <li>✓ Support 24/7</li>
          </ul>
          <button className="w-full py-2 px-4 bg-primary text-white rounded-lg">Kontakt</button>
        </div>
      </div>
    </section>
  );
};
export default PricingSection;
