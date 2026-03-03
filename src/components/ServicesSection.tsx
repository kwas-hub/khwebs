import { motion } from "framer-motion";
import { Layers, Zap, TrendingUp } from "lucide-react";

const services = [
  {
    icon: Layers,
    title: "Digitalisieren",
    description: "Analoge Prozesse in moderne digitale Workflows verwandeln. Dokumentenmanagement, Cloud-Migration und digitale Schnittstellen.",
    tags: ["Cloud", "SaaS", "APIs"],
  },
  {
    icon: Zap,
    title: "Automatisieren",
    description: "Wiederkehrende Aufgaben eliminieren. Intelligente Automatisierungen, die Zeit und Ressourcen sparen – rund um die Uhr.",
    tags: ["RPA", "Workflows", "Integration"],
  },
  {
    icon: TrendingUp,
    title: "Optimieren",
    description: "Bestehende Systeme analysieren, Engpässe identifizieren und messbare Verbesserungen umsetzen. Datengetrieben und nachhaltig.",
    tags: ["Analytics", "Performance", "Strategie"],
  },
];

const ServicesSection = () => {
  return (
    <section id="leistungen" className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="mb-3 font-mono text-sm tracking-widest text-primary">LEISTUNGEN</p>
          <h2 className="text-3xl font-bold md:text-5xl">
            Was ich für Sie <span className="text-gradient">bewege</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="group rounded-lg border border-border bg-card p-8 transition-all hover:border-primary/30 hover:glow-border"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <service.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">{service.title}</h3>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
              <div className="flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
