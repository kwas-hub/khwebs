import { createTransport } from 'nodemailer';

export const config = {
  runtime: 'edge', // Optional für schnellere Ausführung
};

export default async function handler(req: Request) {
  // CORS Headers für die Kommunikation mit dem Frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  try {
    const { firstName, lastName, subject, message } = await req.json();

    // Nutzt die Secrets, die du in Lovable/Vercel hinterlegt hast
    const transporter = createTransport({
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}