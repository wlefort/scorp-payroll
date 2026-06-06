const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    CLAUDE_TOKEN: env.CLAUDE_TOKEN ? "SET" : "NOT SET",
    GITHUB_TOKEN: env.GITHUB_TOKEN ? "SET" : "NOT SET",
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
}
