/**
 * PLANTILLA — BISONTES DUX
 * -------------------------
 * Cada jugador puede tener:
 *   name     → Nombre completo
 *   position → Posición (ej: "POR", "DFC", "MCO"...)
 *   dorsal   → Número de camiseta (solo jugadores; el staff usa "role")
 *   photo    → Ruta a la foto (OPCIONAL — si no se pone, se busca assets/jugadorN.png)
 *   age      → Edad (OPCIONAL)
 *   nationalities → Una o dos nacionalidades, en una lista (OPCIONAL)
 *   trajectory   → Trayectoria, en orden de más reciente a más antigua (OPCIONAL)
 *   bio      → Descripción breve (OPCIONAL)
 *   stats    → Estadísticas reales en formato { etiqueta: valor } (OPCIONAL)
 *   socials  → Redes en formato { instagram, x, tiktok, facebook } (OPCIONAL)
 *   nickname → Apodo (OPCIONAL). Es lo que va estampado en la espalda de la
 *              camiseta en la portada y en la ficha; si no hay, se usa el apellido.
 *   role     → Solo para el staff (sin dorsal): "entrenador" o "directiva".
 *              En "position" va el cargo, p. ej. "ENTRENADOR" o "COMMUNITY MANAGER".
 *
 * Ejemplo:
 *   {
 *     dorsal: 10,
 *     name: "García, Juan",
 *     position: "Mediapunta",
 *     nationalities: ["España", "Argentina"],
 *     trajectory: [
 *       "2025–actualidad · Bisontes DUX",
 *       "2023–2025 · Club anterior"
 *     ]
 *   }
 *   { role: "entrenador", name: "Apellido, Nombre", position: "ENTRENADOR" }
 *   { role: "directiva", name: "Apellido, Nombre", position: "COMMUNITY MANAGER" }
 *
 * Para una sola nacionalidad usa, por ejemplo: nationalities: ["España"]
 * Si todavía no hay datos, omite el campo o utiliza una lista vacía: []
 */

const players = [
  { role: "entrenador", name: "Gunduz, Ben",      position: "ENTRENADOR", nickname: "Ben" },
  { role: "entrenador", name: "Chicaiza, Flavio", position: "ENTRENADOR" },
  { role: "directiva",  name: "Loi, Fabio",       position: "COMMUNITY MANAGER", photo: "assets/jugador2.png" },
  { dorsal: 1,  name: "Copa, Alejandro",        position: "POR", trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 3,  name: "Navas, Bruno",           position: "DFC", captain: true, trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 4,  name: "Arias, Miguel",          position: "MC" , nickname: "Miguelín", trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 6,  name: "Jose Anthony",           position: "MC" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 7,  name: "Gálvez, Alan",           position: "EI" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 8,  name: "Anton",                  position: "MC" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 9,  name: "Max",                    position: "DC" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 10, name: "Tekiela, Filip",         position: "DC" , captain: true, trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 11, name: "Salas, Luis",            position: "ED" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 12, name: "Javi",                   position: "ED" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 15, name: "Constantine, Arturo",    position: "EI" , nickname: "Arturito", trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 17, name: "Cristhofer",             position: "ED" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 20, name: "Izan",                   position: "MC" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 21, name: "Naharro, Elías",         position: "LI" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 22, name: "Comas, Mario",           position: "LD" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 25, name: "Daza, Francisco",        position: "DFC", trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 28, name: "Leonardo",               position: "DFC", trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 33, name: "Coronel",                position: "DFC", trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 42, name: "Floria, Dani",           position: "DFC", trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 67, name: "Santi",                  position: "MC" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 69, name: "Mateo",                  position: "ED" , trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  { dorsal: 99, name: "Arrufat, Diego",         position: "MCO", captain: true, trajectory: ["2025–actualidad · Bisontes DUX", "A.D.C. Malasaña"] },
  // Pendientes de dorsal (sin número la ficha mostraría "undefined"):
  // { dorsal: ?, name: "Tagara, Leo",          position: "DFC" },
  // { dorsal: ?, name: "Carlitos",             position: "DFC" },
];
