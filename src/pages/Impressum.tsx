import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Impressum = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Startseite
        </Link>

        <h1 className="mb-8 text-3xl font-bold">Impressum</h1>

        <div className="space-y-6 text-muted-foreground">
          <div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Angaben gemäß § 5 TMG</h2>
            <p>
              KH Webs<br />
              Musterstraße 1<br />
              12345 Musterstadt
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Kontakt</h2>
            <p>
              Telefon: 0156 79715277<br />
              E-Mail: hello@khwebs.de
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
            <p>
              KH Webs<br />
              Musterstraße 1<br />
              12345 Musterstadt
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Haftungsausschluss</h2>
            <h3 className="mb-1 font-medium text-foreground">Haftung für Inhalte</h3>
            <p className="mb-4">
              Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            </p>
            <h3 className="mb-1 font-medium text-foreground">Haftung für Links</h3>
            <p>
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Impressum;
