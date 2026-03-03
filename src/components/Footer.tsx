const Footer = () => {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <span className="font-mono text-sm text-muted-foreground">
          © {new Date().getFullYear()} dev.io
        </span>
        <div className="flex gap-6">
          {["Impressum", "Datenschutz"].map((item) => (
            <a key={item} href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
