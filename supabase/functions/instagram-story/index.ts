// ============================================================
// BISONTES DUX — instagram-story (Supabase Edge Function)
// El panel /admin/partido/ monta la historia (JPG 1080×1920), la
// sube a galeria-publica/historias/ y llama aquí. Esta función
// comprueba que quien llama es admin y la publica como historia de
// Instagram con la API oficial (Instagram API with Instagram Login).
// La llave de Instagram solo vive aquí (secretos IG_USER_ID e
// IG_ACCESS_TOKEN). Sin ellos responde 501 y el panel ofrece
// compartir la historia a mano desde el móvil.
// Despliegue: Supabase → Edge Functions → instagram-story, con
// «Verify JWT» desactivado (la sesión se comprueba aquí dentro).
// Al pasar al servidor propio: misma lógica, cambia solo Deno.serve.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const ALLOWED_ORIGINS = ["https://urpito.github.io", "https://bisontesdux.es", "https://www.bisontesdux.es", "http://localhost:8765"];
const API = `https://graph.instagram.com/${Deno.env.get("IG_API_VERSION") || "v23.0"}`;

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

async function instagram(path: string, params: Record<string, string>, method = "POST") {
  const query = new URLSearchParams({ ...params, access_token: Deno.env.get("IG_ACCESS_TOKEN")! });
  const res = await fetch(method === "GET" ? `${API}/${path}?${query}` : `${API}/${path}`, method === "GET" ? {} : {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: query,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Instagram ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405, origin);

  // ¿Quién llama y es admin?
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply({ error: "Hay que entrar con tu cuenta." }, 401, origin);
  const publicKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: user, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !user?.user) return reply({ error: "Sesión caducada: vuelve a entrar." }, 401, origin);
  const { data: isAdmin, error: roleError } = await supabase.rpc("gallery_is_admin");
  if (roleError || isAdmin !== true) return reply({ error: "Solo los admins pueden publicar historias." }, 403, origin);

  if (!Deno.env.get("IG_USER_ID") || !Deno.env.get("IG_ACCESS_TOKEN")) {
    return reply({ error: "Instagram todavía no está conectado (faltan IG_USER_ID e IG_ACCESS_TOKEN).", notConfigured: true }, 501, origin);
  }

  let body: { image_url?: string };
  try { body = await req.json(); } catch { return reply({ error: "Petición no válida" }, 400, origin); }
  // Solo imágenes de nuestras historias: nadie puede usar esto para publicar otra cosa.
  const allowedPrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/galeria-publica/historias/`;
  const imageUrl = String(body.image_url || "");
  if (!imageUrl.startsWith(allowedPrefix) || !/\.jpg$/i.test(imageUrl)) return reply({ error: "Esa imagen no es una historia del panel." }, 400, origin);

  try {
    const igUser = Deno.env.get("IG_USER_ID")!;
    const container = await instagram(`${igUser}/media`, { image_url: imageUrl, media_type: "STORIES" });
    // Instagram procesa la imagen antes de dejar publicarla.
    for (let i = 0; i < 10; i++) {
      const status = await instagram(container.id, { fields: "status_code" }, "GET");
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`Instagram no aceptó la imagen (${status.status_code}).`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const published = await instagram(`${igUser}/media_publish`, { creation_id: container.id });
    return reply({ id: published.id }, 200, origin);
  } catch (error) {
    return reply({ error: `No se pudo publicar en Instagram: ${(error as Error).message}` }, 502, origin);
  }
});
