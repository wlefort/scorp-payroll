const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GITHUB_REPO = "wlefort/scorp-payroll";
const FILE_PATH   = "src/App.jsx";

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const { description } = await request.json();
    if (!description) return json({ error: "No description provided" }, 400);

    const ANTHROPIC_API_KEY = env.CLAUDE_TOKEN || env["CLAUDE_TOKEN "] || env.ANTHROPIC_API_KEY;
    const GITHUB_TOKEN      = env.GITHUB_TOKEN || env["GITHUB_TOKEN "];
    if (!ANTHROPIC_API_KEY) return json({ error: "CLAUDE_TOKEN not set" }, 500);
    if (!GITHUB_TOKEN)      return json({ error: "GITHUB_TOKEN not set" }, 500);

    // 1. Fetch current App.jsx from GitHub
    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": "scorp-recode" } }
    );
    if (!ghRes.ok) return json({ error: `GitHub read failed: ${ghRes.status}` }, 500);
    const ghData = await ghRes.json();
    // decodeURIComponent(escape(...)) mirrors the encode side below — atob() alone
    // mangles multi-byte UTF-8 chars (em dashes, emoji) into garbage.
    const currentCode = decodeURIComponent(escape(atob(ghData.content.replace(/\n/g, ""))));
    const sha = ghData.sha;
    const originalLineCount = currentCode.split("\n").length;

    // 2. Call Claude to modify the code
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 16000,
        messages: [{
          role: "user",
          content: `You are modifying a React single-file app (src/App.jsx).
Return ONLY the complete updated JSX file with no explanation, no markdown, no code fences — just raw JSX code starting with the import statement.
You MUST return the ENTIRE file, including all unrelated parts unchanged — never truncate or summarize sections.

USER REQUEST:
${description}

CURRENT CODE:
${currentCode}`
        }]
      })
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return json({ error: `Claude API failed: ${err}` }, 500);
    }

    const claudeData = await claudeRes.json();
    const newCode = claudeData.content?.[0]?.text?.trim();
    if (!newCode || !newCode.startsWith("import")) {
      return json({ error: "Claude returned unexpected output — no changes made" }, 500);
    }

    // Safety check: reject obviously truncated/corrupted output rather than bricking the live app
    const newLineCount = newCode.split("\n").length;
    if (newLineCount < originalLineCount * 0.7) {
      return json({ error: `Refused to apply — output looked truncated (${newLineCount} lines vs ${originalLineCount} original). No changes made.` }, 500);
    }
    if (!newCode.trimEnd().endsWith("}")) {
      return json({ error: "Refused to apply — output didn't end with a closing brace, likely truncated. No changes made." }, 500);
    }

    // 3. Commit updated file back to GitHub
    const encoded = btoa(unescape(encodeURIComponent(newCode)));
    const commitRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "scorp-recode",
        },
        body: JSON.stringify({
          message: `AI update: ${description.slice(0, 72)}`,
          content: encoded,
          sha,
        }),
      }
    );

    if (!commitRes.ok) {
      const err = await commitRes.text();
      return json({ error: `GitHub commit failed: ${err}` }, 500);
    }

    return json({ ok: true, message: "Code updated and pushed — Cloudflare will redeploy in ~30s" });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
