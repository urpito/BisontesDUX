/**
 * PATROCINADORES — BISONTES DUX
 * ------------------------------
 * Cada sponsor tiene:
 *   name        → Nombre del patrocinador
 *   description → Frase corta que aparece bajo el logo (1 línea)
 *   logo        → Ruta a la imagen (colócala en assets/ y escribe la ruta aquí)
 *   url         → Enlace al hacer clic (deja "" si no hay)
 *
 * Tamaño recomendado: 200×80 px, fondo transparente (PNG o SVG).
 */

const sponsors = [
  { tier: "principal",   name: "Todos Juegan",      description: "Asociación sin ánimos de lucro que busca equipos a jóvenes en riesgo de exclusión", logo: "assets/todosjuegan.png", url: "https://todosjuegan.org/" },
  { tier: "colaborador", name: "Fratelli D'Italia",  description: "Cadena de restaurantes de comida traidiconal Sarda en Madrid", logo: "assets/fratellilogo.png", url: "https://fratelliditalia.es" },
  { tier: "colaborador", name: "Alcze",           description: "Empresa de construcción en Polonia", logo: "assets/alczelogo.png", url: "" },
  { tier: "colaborador", name: "ISOS",           description: "In Search Of Stars - Agencia deportiva que se encarga de asegurarse que las estrellas estén en su lugar.",     logo: "assets/isoslogo.png", url: "" },
  { tier: "colaborador", name: "PcFactory",           description: "Tienda de informática en la Calle Gaztambide.",     logo: "https://pcfactorycomputer.com/wp-content/uploads/2025/07/cropped-Isologo-RGB_01.-Color-primario.png", url: "https://pcfactorycomputer.com/" },
];
