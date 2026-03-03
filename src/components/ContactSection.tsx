import { motion } from "framer-motion";
import { Mail, ArrowRight } from "lucide-react";

const ContactSection = () => {
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
            Lassen Sie uns in einem kostenlosen Erstgespräch herausfinden,
            wie ich Ihre Prozesse transformieren kann.
          </p>

          <div className="mx-auto max-w-md space-y-4">
            <a
              href="mailto:hello@dev.io"
              className="group flex items-center justify-center gap-3 rounded-md bg-primary px-8 py-4 font-medium text-primary-foreground transition-all hover:shadow-[0_0_30px_hsl(185_80%_55%/0.4)]"
            >
              <Mail className="h-5 w-5" />
              Erstgespräch vereinbaren
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <p className="text-sm text-muted-foreground">
              Oder direkt per E-Mail: <span className="font-mono text-primary">hello@dev.io</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;
