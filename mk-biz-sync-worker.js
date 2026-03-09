/*
  ╔══════════════════════════════════════════════════╗
  ║   MOONSKAI BIZ — Cloudflare Worker Sync          ║
  ║   mk-biz-sync-worker.js                          ║
  ║   Moonskai Labs L.L.C.                           ║
  ╚══════════════════════════════════════════════════╝

  SETUP INSTRUCTIONS (5 minutes):
  ─────────────────────────────────────────────────
  1. Go to dash.cloudflare.com → Workers & Pages
  2. Click "Create" → "Create Worker"
  3. Name it: mk-biz-sync
  4. Delete all the default code and paste THIS file
  5. Click "Deploy"

  6. Now add KV storage:
     → Go to Workers & Pages → KV
     → Click "Create namespace"
     → Name it: MK_BIZ_DATA
     → Click Add

  7. Bind KV to your Worker:
     → Go back to your mk-biz-sync Worker
     → Settings → Bindings → Add → KV Namespace
     → Variable name: MK_BIZ (must be exact)
     → KV Namespace: MK_BIZ_DATA
     → Click Deploy

  8. Set your secret token:
     → Settings → Environment Variables → Add
     → Variable name: AUTH_TOKEN
     → Value: make up any password, e.g. "moonskai2026secret"
     → Click Encrypt → Deploy

  9. Copy your Worker URL from the top of the page
     It looks like: https://mk-biz-sync.YOURNAME.workers.dev

  10. Open Moonskai Biz → DATA tab → Cloud Sync
      → Paste the Worker URL
      → Paste your AUTH_TOKEN value
      → Hit "Push to Cloud"

  On your phone, do step 10 with the same URL and token,
  then hit "Pull from Cloud".

  That's it — fully synced.
*/

export default {
  async fetch(request, env) {

    // ── CORS headers (needed for browser fetch calls) ──
    const cors = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── Auth check ──
    const token = request.headers.get('X-Auth-Token') || '';
    if (!env.AUTH_TOKEN || token !== env.AUTH_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ── GET — Pull data ──
    if (request.method === 'GET') {
      const data = await env.MK_BIZ.get('sync_data');
      if (!data) {
        return new Response(
          JSON.stringify({ empty: true }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(data, {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // ── PUT — Push data ──
    if (request.method === 'PUT') {
      let body;
      try {
        body = await request.text();
        JSON.parse(body); // validate it's real JSON before storing
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
      await env.MK_BIZ.put('sync_data', body);
      return new Response(
        JSON.stringify({ ok: true, savedAt: new Date().toISOString() }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ── Other methods ──
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
};
