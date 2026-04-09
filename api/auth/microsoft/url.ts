import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const SCOPES = 'files.readwrite.all offline_access';
  
  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'MICROSOFT_CLIENT_ID not configured' });
  }

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/microsoft/callback`;

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(SCOPES)}`;
  
  res.json({ url: authUrl });
}
