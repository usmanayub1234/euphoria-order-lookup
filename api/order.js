// api/order.js — Vercel Serverless Function
// Uses SHOPIFY_ACCESS_TOKEN (shpat_...) from environment variables

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

  const shop        = process.env.SHOPIFY_SHOP;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shop || !accessToken) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  try {
    const fields = [
      'id','order_number','name','email',
      'created_at','financial_status','fulfillment_status',
      'cancelled_at','total_price','currency',
      'line_items','fulfillments','shipping_address'
    ].join(',');

    const url = `https://${shop}/admin/api/2024-01/orders.json`
      + `?name=${encodeURIComponent(number)}&status=any&fields=${fields}`;

    const orderRes = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error('Shopify error:', orderRes.status, errText);
      return res.status(502).json({
        error: 'Failed to fetch from Shopify',
        status: orderRes.status,
        detail: errText
      });
    }

    const data   = await orderRes.json();
    const orders = data.orders || [];

    const order = orders.find(o =>
      o.email && o.email.toLowerCase() === email.toLowerCase().trim()
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

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
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
