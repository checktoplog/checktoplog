import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // --- Microsoft OAuth Config ---
  const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
  const SCOPES = 'files.readwrite.all offline_access';
  
  // Helper to get the redirect URI
  const getRedirectUri = (req: express.Request) => {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    return `${protocol}://${host}/api/auth/microsoft/callback`;
  };

  // 1. Get Auth URL
  app.get('/api/auth/microsoft/url', (req, res) => {
    if (!CLIENT_ID) {
      return res.status(500).json({ error: 'MICROSOFT_CLIENT_ID not configured' });
    }

    const redirectUri = getRedirectUri(req);
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(SCOPES)}`;
    
    res.json({ url: authUrl });
  });

  // 2. Auth Callback
  app.get('/api/auth/microsoft/callback', async (req, res) => {
    const { code } = req.query;
    const redirectUri = getRedirectUri(req);

    if (!code) {
      return res.status(400).send('No code provided');
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

      // Store tokens in cookies (secure for iframe context)
      res.cookie('ms_access_token', access_token, { 
        maxAge: expires_in * 1000, 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none' 
      });
      res.cookie('ms_refresh_token', refresh_token, { 
        maxAge: 30 * 24 * 60 * 60 * 1000, 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none' 
      });

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
  });

  // 3. Upload to OneDrive
  app.post('/api/onedrive/upload', async (req, res) => {
    const { fileName, fileContent, folderLink } = req.body;
    let accessToken = req.cookies.ms_access_token;
    const refreshToken = req.cookies.ms_refresh_token;

    if (!accessToken && !refreshToken) {
      return res.status(401).json({ error: 'Not authenticated with Microsoft' });
    }

    try {
      // Refresh token if needed
      if (!accessToken && refreshToken) {
        const refreshResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token',
          new URLSearchParams({
            client_id: CLIENT_ID!,
            client_secret: CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        accessToken = refreshResponse.data.access_token;
        res.cookie('ms_access_token', accessToken, { 
          maxAge: refreshResponse.data.expires_in * 1000, 
          httpOnly: true, 
          secure: true, 
          sameSite: 'none' 
        });
      }

      // Resolve the sharing link to get driveId and itemId
      // Sharing link needs to be encoded in base64 without padding
      const sharingUrl = folderLink || process.env.ONEDRIVE_FOLDER_LINK;
      const base64Value = Buffer.from(sharingUrl).toString('base64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
      const shareId = `u!${base64Value}`;

      const shareResponse = await axios.get(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const driveId = shareResponse.data.parentReference.driveId;
      const parentId = shareResponse.data.id;

      // Create a subfolder for the checklist if needed, or just upload directly
      // For now, upload directly to the shared folder
      const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}:/${fileName}:/content`;
      
      // Convert base64 content to Buffer
      const buffer = Buffer.from(fileContent, 'base64');

      await axios.put(uploadUrl, buffer, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/pdf'
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('OneDrive upload error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to upload to OneDrive' });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
