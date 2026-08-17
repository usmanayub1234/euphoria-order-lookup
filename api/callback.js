// api/callback.js
// Visit this once to get your permanent access token
// https://euphoria-order-lookup.vercel.app/api/callback

export default async function handler(req, res) {
  const { code, shop } = req.query;

  if (!code || !shop) {
    return res.status(400).send('Missing code or shop parameter');
  }

  const clientId     = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code:          code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      // Show the token on screen — copy it immediately!
      return res.status(200).send(`
        <html><body style="font-family:sans-serif;padding:2rem;max-width:600px">
          <h2 style="color:#059669">✅ Success! Access Token Generated</h2>
          <p>Copy this token and add it to Vercel as <strong>SHOPIFY_ACCESS_TOKEN</strong>:</p>
          <div style="background:#f3f4f6;padding:1rem;border-radius:8px;word-break:break-all;font-family:monospace;font-size:.9rem;margin:1rem 0">
            ${tokenData.access_token}
          </div>
          <p style="color:#6b7280;font-size:.85rem">After adding to Vercel environment variables, redeploy your project.</p>
        </body></html>
      `);
    } else {
      return res.status(400).send(`Error: ${JSON.stringify(tokenData)}`);
    }
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
