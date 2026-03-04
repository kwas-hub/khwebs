import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <span className="font-mono text-sm text-muted-foreground">
          © {new Date().getFullYear()} khwebs digital
        </span>
        <div className="flex gap-6">
          <Link to="/impressum" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Impressum
          </Link>
          <Link to="/datenschutz" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Datenschutz
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
