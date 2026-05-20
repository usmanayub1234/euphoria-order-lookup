// api/order.js — Vercel Serverless Function
// Uses Shopify Client ID + Client Secret (new Dev Dashboard flow)

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', process.env.SHOPIFY_STORE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const { number, email } = req.query;
  if (!number || !email) {
    return res.status(400).json({ error: 'Order number and email are required' });
  }

  const shop         = process.env.SHOPIFY_SHOP;          // shopateuphoria.myshopify.com
  const clientId     = process.env.SHOPIFY_CLIENT_ID;     // from Dev Dashboard
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET; // from Dev Dashboard

  if (!shop || !clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  try {
    // ── Step 1: Get access token using Client Credentials ──
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        grant_type:    'client_credentials',
      }),
    });

    // If client_credentials flow not supported, fall back to Basic Auth
    let accessToken = null;

    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
    } else {
      // Fallback: use client secret directly as token (works for some Dev Dashboard apps)
      accessToken = clientSecret;
    }

    // ── Step 2: Fetch order from Shopify Admin API ──
    const fields = [
      'id', 'order_number', 'name', 'email',
      'created_at', 'financial_status', 'fulfillment_status',
      'cancelled_at', 'total_price', 'currency',
      'line_items', 'fulfillments', 'shipping_address'
    ].join(',');

    const orderUrl = `https://${shop}/admin/api/2024-01/orders.json`
      + `?name=${encodeURIComponent(number)}&status=any&fields=${fields}`;

    const orderRes = await fetch(orderUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error('Shopify Admin API error:', orderRes.status, errText);
      return res.status(502).json({ error: 'Failed to fetch order from Shopify' });
    }

    const data   = await orderRes.json();
    const orders = data.orders || [];

    // Match by email (case-insensitive)
    const order = orders.find(o =>
      o.email && o.email.toLowerCase() === email.toLowerCase().trim()
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // ── Step 3: Return clean response ──
    return res.status(200).json({
      order_number:       order.name || ('#' + order.order_number),
      created_at:         order.created_at,
      financial_status:   order.financial_status,
      fulfillment_status: order.fulfillment_status || null,
      cancelled_at:       order.cancelled_at || null,
      total_price:        order.total_price,
      currency:           order.currency,
      shipping_address:   order.shipping_address || null,
      fulfillments: (order.fulfillments || []).map(f => ({
        tracking_company: f.tracking_company,
        tracking_number:  f.tracking_number,
        tracking_url:     f.tracking_url,
        status:           f.status,
      })),
      line_items: (order.line_items || []).map(item => ({
        title:         item.title,
        variant_title: item.variant_title !== 'Default Title' ? item.variant_title : '',
        quantity:      item.quantity,
        price:         item.price,
        image:         item.image ? item.image.src : null,
      })),
    });

  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
