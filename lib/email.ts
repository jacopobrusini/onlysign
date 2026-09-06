import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail({
  email,
  username,
  token,
}: {
  email: string;
  username: string;
  token: string;
}) {
  const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://onlysign.vercel.app"
    : "http://localhost:3000");

  const verificationUrl =
    `${appUrl}/verifica-email?token=${encodeURIComponent(token)}`;

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "onlySign <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject: "Verifica il tuo account onlySign",
    html: `
      <!DOCTYPE html>
      <html lang="it">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verifica il tuo account onlySign</title>
        </head>

        <body
          style="
            margin: 0;
            padding: 0;
            background: #000000;
            font-family: Arial, Helvetica, sans-serif;
            color: #ffffff;
          "
        >
          <div
            style="
              max-width: 600px;
              margin: 0 auto;
              padding: 48px 24px;
            "
          >
            <div
              style="
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px;
                padding: 40px 32px;
                background: #0a0a0a;
              "
            >
              <h1
                style="
                  margin: 0 0 24px;
                  font-size: 28px;
                  font-weight: 600;
                "
              >
                Benvenuto su onlySign 👋
              </h1>

              <p
                style="
                  margin: 0 0 16px;
                  font-size: 16px;
                  line-height: 1.6;
                  color: #d4d4d4;
                "
              >
                  Ciao ${username},
              </p>

              <p
                style="
                  margin: 0 0 32px;
                  font-size: 16px;
                  line-height: 1.6;
                  color: #a3a3a3;
                "
              >
                Grazie per esserti registrato su onlySign.
                Per completare la registrazione devi verificare
                il tuo indirizzo email.
              </p>

              <a
                href="${verificationUrl}"
                style="
                  display: inline-block;
                  padding: 14px 24px;
                  border-radius: 14px;
                  background: #ffffff;
                  color: #000000;
                  text-decoration: none;
                  font-size: 15px;
                  font-weight: 600;
                "
              >
                Verifica il mio account
              </a>

              <p
                style="
                  margin: 32px 0 0;
                  font-size: 13px;
                  line-height: 1.6;
                  color: #737373;
                "
              >
                Il link di verifica sarà valido per 24 ore.
              </p>

              <p
                style="
                  margin: 16px 0 0;
                  font-size: 13px;
                  line-height: 1.6;
                  color: #525252;
                "
              >
                Se non hai creato tu questo account,
                puoi ignorare questa email.
              </p>
            </div>

            <p
              style="
                margin: 24px 0 0;
                text-align: center;
                font-size: 12px;
                color: #525252;
              "
            >
              © onlySign
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}