/**
 * PLANTILLA — BISONTES DUX
 * -------------------------
 * Cada jugador puede tener:
 *   name     → Nombre completo
 *   position → Posición (ej: "POR", "DFC", "MCO"...)
 *   dorsal   → Número de camiseta o "COACH"
 *   photo    → Ruta a la foto (OPCIONAL — si no se pone, se busca assets/jugadorN.png)
 *   age      → Edad (OPCIONAL)
 *   nationalities → Una o dos nacionalidades, en una lista (OPCIONAL)
 *   trajectory   → Trayectoria, en orden de más reciente a más antigua (OPCIONAL)
 *   bio      → Descripción breve (OPCIONAL)
 *   stats    → Estadísticas reales en formato { etiqueta: valor } (OPCIONAL)
 *   socials  → Redes en formato { instagram, x, tiktok, facebook } (OPCIONAL)
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
 *   { dorsal: "COACH", name: "Entrenador", position: "Entrenador", photo: "assets/coach.jpg" }
 *
 * Para una sola nacionalidad usa, por ejemplo: nationalities: ["España"]
 * Si todavía no hay datos, omite el campo o utiliza una lista vacía: []
 */

const players = [
  { dorsal: "COACH", name: "Gunduz, Ben",       position: "ENTRENADOR",         photo: "assets/coach_ben.jpg"    },
  { dorsal: "COACH", name: "Chicaiza, Flavio",  position: "SEGUNDO ENTRENADOR", photo: "assets/coach_flavio.jpg" },
  { dorsal: 1,  name: "Copa, Alejandro",        position: "POR" },
  { dorsal: 2,  name: "Loi, Fabio",             position: "LI"  },
  { dorsal: 3,  name: "Navas, Bruno",           position: "DFC" },
  { dorsal: 4,  name: "Arias, Miguel",          position: "MC"  },
  { dorsal: 5,  name: "Ossama",                 position: "LD"  },
  { dorsal: 7,  name: "Gálvez, Alan",           position: "EI"  },
  { dorsal: 9,  name: "Bebia, Eduardo",         position: "ED"  },
  { dorsal: 10, name: "Tekiela, Filip",         position: "DC"  },
  { dorsal: 11, name: "Salas, Luis",            position: "ED"  },
  { dorsal: 13, name: "Arick, Taiyang",         position: "MCO" },
  { dorsal: 15, name: "Constantine, Arturo",    position: "EI"  },
  { dorsal: 18, name: "Jeanca",                 position: "LD"  },
  { dorsal: 19, name: "Diarra, Yacouba",        position: "MCO" },
  { dorsal: 21, name: "Naharro, Elías",         position: "LI"  },
  { dorsal: 22, name: "Comas, Mario",           position: "LD"  },
  { dorsal: 23, name: "Chicaiza, Nicolás",      position: "DC"  },
  { dorsal: 25, name: "Daza, Francisco",        position: "DFC" },
  { dorsal: 99, name: "Arrufat, Diego",         position: "MCO" },
];
