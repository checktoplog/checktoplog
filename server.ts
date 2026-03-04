import express from "express";
import { createServer as createViteServer } from "vite";
import { OAuth2Client } from "google-auth-library";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn("AVISO: Credenciais do Google OAuth não configuradas. O login não funcionará.");
}

// Use APP_URL from environment or fallback to current host
const getBaseUrl = (req: express.Request) => {
  return process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
};

const getRedirectUri = (req: express.Request) => {
  return `${getBaseUrl(req)}/auth/google/callback`;
};

const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

app.use(express.json());
app.use(cookieParser());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 1. Get Google Auth URL
app.get("/api/auth/google/url", (req, res) => {
  const redirectUri = getRedirectUri(req);
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    redirect_uri: redirectUri,
  });
  res.json({ url });
});

// 2. Google OAuth Callback
app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  const redirectUri = getRedirectUri(req);
  console.log("Google Callback - Code received, Redirect URI:", redirectUri);

  try {
    const { tokens } = await client.getToken({
      code: code as string,
      redirect_uri: redirectUri,
    });
    console.log("Google Callback - Tokens obtained successfully");
    client.setCredentials(tokens);

    // Get user info
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    console.log("Google Callback - User payload:", payload?.email);

    // Set user info in a cookie (SameSite=None, Secure=true for iframe support)
    res.cookie("user", JSON.stringify(payload), {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    console.log("Google Callback - Cookie set, sending success script");

    // Send success message to parent window and close popup
    res.send(`
      <html>
        <body>
          <script>
            console.log("Callback script executing...");
            if (window.opener) {
              console.log("Notifying opener...");
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS',
                user: ${JSON.stringify(payload)}
              }, '*');
              setTimeout(() => {
                console.log("Closing popup...");
                window.close();
              }, 500);
            } else {
              console.log("No opener found, redirecting to home...");
              window.location.href = '/';
            }
          </script>
          <p>Autenticação bem-sucedida. Esta janela será fechada automaticamente.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Erro no callback do Google:", error);
    res.status(500).send("Erro na autenticação.");
  }
});

// 3. Get Current User
app.get("/api/auth/me", (req, res) => {
  const userCookie = req.cookies.user;
  console.log("API Auth Me - Cookie present:", !!userCookie);
  if (userCookie) {
    try {
      res.json(JSON.parse(userCookie));
    } catch (e) {
      console.error("API Auth Me - Error parsing cookie:", e);
      res.status(500).json({ error: "Erro ao processar sessão" });
    }
  } else {
    res.status(401).json({ error: "Não autenticado" });
  }
});

// 4. Logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("user", {
    secure: true,
    sameSite: "none",
  });
  res.json({ success: true });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  // Serve static files in production
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
