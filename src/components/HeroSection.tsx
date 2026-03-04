import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

const HeroSection = () => {
  return (
    <section id="hero" className="relative flex min-h-screen items-center justify-center overflow-hidden grid-bg">
      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(185_80%_55%/0.08)_0%,transparent_70%)]" />
      
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <p className="mb-6 font-mono text-sm tracking-widest text-primary">
            Eng/IO | FREELANCE IT CONSULTANT
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-8 text-5xl font-bold leading-tight tracking-tight md:text-7xl lg:text-8xl"
        >
          <span className="text-foreground">Ich </span>
          <span className="text-gradient glow-text">digitalisiere</span>
          <span className="text-foreground">,</span>
          <br />
          <span className="text-gradient glow-text">automatisiere</span>
          <span className="text-foreground"> & </span>
          <br />
          <span className="text-gradient glow-text">optimiere</span>
          <span className="text-foreground"> Ihr Business.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mx-auto mb-12 max-w-2xl text-lg text-muted-foreground md:text-xl"
        >
          Prozesse vereinfachen. Systeme verbinden. Wachstum ermöglichen.
          <br />
          Von der Analyse bis zur Umsetzung – alles aus einer Hand.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <button
            onClick={() => document.getElementById("kontakt")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-md bg-primary px-8 py-3 font-medium text-primary-foreground transition-all hover:shadow-[0_0_30px_hsl(185_80%_55%/0.4)]"
          >
            Jetzt beraten lassen
          </button>
          <button
            onClick={() => document.getElementById("leistungen")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-md border border-border px-8 py-3 font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            Leistungen entdecken
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-24"
        >
          <ArrowDown className="mx-auto h-5 w-5 animate-bounce text-muted-foreground" />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
