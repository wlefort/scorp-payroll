const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  try {
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS appdata (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`
    );
    const row = await env.DB.prepare("SELECT payload FROM appdata WHERE id = 1").first();
    if (!row) return new Response(JSON.stringify(null), { headers: { ...CORS, "Content-Type": "application/json" } });
    return new Response(row.payload, { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS appdata (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`
    );
    const body = await request.text();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO appdata (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
    ).bind(body, now).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}
