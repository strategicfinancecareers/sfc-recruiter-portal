import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL required' });
  }
  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobParser/1.0)'
      }
    });
    const html = await response.text();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch URL' });
  }
}
