import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error, error_description } = req.query;
  const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/microsoft/callback`;

  if (error) {
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #d32f2f;">Erro na Autenticação Microsoft</h2>
          <p><b>Erro:</b> ${error}</p>
          <p><b>Descrição:</b> ${error_description || 'Sem descrição.'}</p>
          <hr/>
          <p>Verifique se a <b>Redirect URI</b> no Azure está exatamente como: <br/><code>${redirectUri}</code></p>
          <button onclick="window.close()">Fechar Janela</button>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('Nenhum código de autorização foi recebido da Microsoft.');
  }

  try {
    const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', 
      new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        code: code as string,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Set cookies for Vercel
    res.setHeader('Set-Cookie', [
      `ms_access_token=${access_token}; Max-Age=${expires_in}; Path=/; HttpOnly; Secure; SameSite=None`,
      `ms_refresh_token=${refresh_token}; Max-Age=${30 * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=None`
    ]);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MS_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação concluída com sucesso! Esta janela fechará automaticamente.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error exchanging code:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
}
