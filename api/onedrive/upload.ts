import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName, fileContent, folderLink } = req.body;
  const cookies = parse(req.headers.cookie || '');
  let accessToken = cookies.ms_access_token;
  const refreshToken = cookies.ms_refresh_token;

  const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ error: 'Not authenticated with Microsoft' });
  }

  try {
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
      res.setHeader('Set-Cookie', [
        `ms_access_token=${accessToken}; Max-Age=${refreshResponse.data.expires_in}; Path=/; HttpOnly; Secure; SameSite=None`
      ]);
    }

    const sharingUrl = folderLink || process.env.ONEDRIVE_FOLDER_LINK;
    const base64Value = Buffer.from(sharingUrl).toString('base64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
    const shareId = `u!${base64Value}`;

    const shareResponse = await axios.get(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const driveId = shareResponse.data.parentReference.driveId;
    const parentId = shareResponse.data.id;

    const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}:/${fileName}:/content`;
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
}
