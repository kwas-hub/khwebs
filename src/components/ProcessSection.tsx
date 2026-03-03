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
