import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS Header setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Vorab-Check für Browser (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, lastName, email subject, message } = req.body;

    // Validierung der Eingaben
    if (!firstName || !lastName || !message) {
      return res.status(400).json({ error: 'Bitte alle Pflichtfelder ausfüllen.' });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.strato.de",
      port: 465,
      secure: true,
      auth: {
        user: process.env.STRATO_EMAIL,
        pass: process.env.STRATO_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.STRATO_EMAIL,
      to: "hello@khwebs.de",
      replyTo: email,
      subject: `Neue Anfrage: ${subject}`,
      html: `
        <h2>Neue Aktanfrage</h2>
        <p>Von: <strong>${firstName} ${lastName}</strong></p>
        <p>Email: <strong>${email}</strong></p>
        <p>Thema:<strong> ${subject}</strong></p>
        <hr />
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    // WICHTIG: Explizite JSON Antwort senden
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("SMTP Error:", error);
    // Sicherstellen, dass auch im Fehlerfall JSON kommt
    return res.status(500).json({ error: error.message || 'Interner Serverfehler' });
  }
}