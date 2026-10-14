// ============================================================
// BISONTES DUX — admin-github (Supabase Edge Function)
// El panel /admin/ entra con correo y contraseña (Supabase Auth).
// Esta función comprueba que quien llama es admin de la galería y
// lee o guarda en GitHub con una llave que solo vive aquí
// (secreto GITHUB_TOKEN). Solo deja tocar data/*.js y las carpetas
// de imágenes de la web: nunca workflows ni código.
// Despliegue: Supabase → Edge Functions → admin-github, con
// «Verify JWT» desactivado (la sesión se comprueba aquí dentro).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const REPO = "urpito/BisontesDUX";
const BRANCH = "main";
const ALLOWED_ORIGINS = ["https://urpito.github.io", "http://localhost:8765"];
const ALLOWED_PATH = /^(data\/[a-z]+\.js|assets\/(uploads|sponsors|blog)\/[a-z0-9-]+\.(webp|png|jpg))$/;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

async function github(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get("GITHUB_TOKEN")}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "bisontes-admin",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405, origin);
  if (!Deno.env.get("GITHUB_TOKEN")) return reply({ error: "Falta configurar la llave de GitHub (secreto GITHUB_TOKEN)." }, 500, origin);

  // ¿Quién llama y es admin de la galería?
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply({ error: "Hay que entrar con tu cuenta." }, 401, origin);
  /* Clave pública del proyecto: la que manda el panel (es pública por diseño). */
  const publicKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: user, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !user?.user) return reply({ error: "Sesión caducada: vuelve a entrar." }, 401, origin);
  const { data: isAdmin, error: roleError } = await supabase.rpc("gallery_is_admin");
  if (roleError || isAdmin !== true) return reply({ error: "Solo los admins pueden editar la web." }, 403, origin);

  let body: { action?: string; path?: string; content?: string; message?: string; sha?: string };
  try { body = await req.json(); } catch { return reply({ error: "Petición no válida" }, 400, origin); }
  const path = String(body.path || "");
  if (!ALLOWED_PATH.test(path)) return reply({ error: `No se puede tocar ${path || "esa ruta"} desde el panel.` }, 400, origin);

  if (body.action === "read") {
    const { status, data } = await github(`${path}?ref=${BRANCH}&t=${Date.now()}`);
    if (status !== 200) return reply({ error: `GitHub ${status}: ${data.message || ""}` }, status, origin);
    return reply({ sha: data.sha, content: data.content }, 200, origin);
  }

  if (body.action === "write") {
    if (typeof body.content !== "string" || !body.content) return reply({ error: "Falta el contenido" }, 400, origin);
    const who = user.user.email || "admin";
    const { status, data } = await github(path, {
      method: "PUT",
      body: JSON.stringify({
        message: `${body.message || `admin: actualiza ${path}`} (${who})`,
        content: body.content,
        branch: BRANCH,
        ...(body.sha ? { sha: body.sha } : {}),
      }),
    });
    if (status !== 200 && status !== 201) return reply({ error: `GitHub ${status}: ${data.message || ""}` }, status, origin);
    return reply({ sha: data.content?.sha }, 200, origin);
  }

  return reply({ error: "Acción desconocida" }, 400, origin);
});
