import { motion } from "framer-motion";

const Navbar = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <button onClick={() => scrollTo("hero")} className="font-mono text-sm tracking-wider text-primary">
          {"<"} eng.io {"/>"}
        </button>
        <div className="hidden items-center gap-8 md:flex">
          {["leistungen", "prozess", "kontakt"].map((item) => (
            <button
              key={item}
              onClick={() => scrollTo(item)}
              className="text-sm capitalize text-muted-foreground transition-colors hover:text-foreground"
            >
              {item}
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollTo("kontakt")}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_0_20px_hsl(185_80%_55%/0.3)]"
        >
          Projekt starten
        </button>
      </div>
    </motion.nav>
  );
};

export default Navbar;
