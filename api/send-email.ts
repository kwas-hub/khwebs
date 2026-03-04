import nodemailer from 'nodemailer';

// Falls diese Zeile bei dir existiert: LÖSCHEN oder auf 'nodejs' ändern
// export const config = { runtime: 'edge' }; 

export default async function handler(req: any, res: any) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, lastName, subject, message } = req.body;

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
      subject: `Kontaktanfrage: ${subject}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Von:</strong> ${firstName} ${lastName}</p>
        <p><strong>Thema:</strong> ${subject}</p>
        <hr />
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("SMTP Error:", error);
    return res.status(500).json({ error: error.message });
  }
}