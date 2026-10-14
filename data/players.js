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
  {
    "role": "entrenador",
    "name": "Gunduz, Ben",
    "position": "ENTRENADOR",
    "nickname": "Ben",
    "nationalities": [
      "Estados Unidos"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "Cantera F.C.",
      "A.D.C. Malasaña"
    ]
  },
  {
    "role": "entrenador",
    "name": "Arrufat, Jose Ignacio",
    "position": "ENTRENADOR",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "Castellón",
      "A.D.C. Malasaña",
      "Cantera F.C."
    ]
  },
  {
    "role": "directiva",
    "name": "Loi, Fabio",
    "position": "COMMUNITY MANAGER",
    "photo": "assets/jugador2.png",
    "nationalities": [
      "Italia"
    ]
  },
  {
    "dorsal": 1,
    "name": "Copa, Alejandro",
    "position": "POR",
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña"
    ]
  },
  {
    "dorsal": 3,
    "name": "Navas, Bruno",
    "position": "DFC",
    "captain": true,
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña"
    ]
  },
  {
    "dorsal": 4,
    "name": "Arias, Miguel",
    "position": "MC",
    "nickname": "Miguelín",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "Munibar Pizarrales",
      "A.D.C. Malasaña"
    ]
  },
  {
    "dorsal": 5,
    "name": "Tagara, Leo",
    "position": "DFC",
    "nationalities": [
      "España",
      "Filipinas"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña"
    ]
  },
  {
    "dorsal": 6,
    "name": "Jose Anthony",
    "position": "MC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "Getafe",
      "A.D.C. Malasaña",
      "San Cristóbal"
    ]
  },
  {
    "dorsal": 7,
    "name": "Gálvez, Alan",
    "position": "EI",
    "nationalities": [
      "Colombia"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 8,
    "name": "Anton",
    "position": "MC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "RCD Espanyol de Madrid"
    ]
  },
  {
    "dorsal": 9,
    "name": "Max",
    "position": "DC",
    "nationalities": [
      "España",
      "Países Bajos"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "RCD Espanyol de Madrid"
    ]
  },
  {
    "dorsal": 10,
    "name": "Tekiela, Filip",
    "position": "DC",
    "captain": true,
    "nationalities": [
      "Polonia"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña"
    ]
  },
  {
    "dorsal": 11,
    "name": "Salas, Luis",
    "position": "ED",
    "nationalities": [
      "Venezuela"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 12,
    "name": "Javi",
    "position": "ED",
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 14,
    "name": "Carlitos",
    "position": "DFC",
    "nationalities": [
      "Ecuador"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña",
      "Cantera F.C."
    ]
  },
  {
    "dorsal": 15,
    "name": "Constantine, Arturo",
    "position": "EI",
    "nickname": "Arturito",
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 17,
    "name": "Cristhofer",
    "position": "ED",
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 20,
    "name": "Izan",
    "position": "MC",
    "nationalities": [
      "Colombia"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 21,
    "name": "Naharro, Elías",
    "position": "LI",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 22,
    "name": "Comas, Mario",
    "position": "LD",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 25,
    "name": "Daza, Francisco",
    "position": "DFC",
    "nationalities": [
      "Venezuela"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 28,
    "name": "Leonardo",
    "position": "DFC",
    "trajectory": [
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 33,
    "name": "Coronel",
    "position": "DFC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña"
    ]
  },
  {
    "dorsal": 42,
    "name": "Floria, Dani",
    "position": "DFC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña",
      "RCD Espanyol de Madrid"
    ]
  },
  {
    "dorsal": 67,
    "name": "Santi",
    "position": "MC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "RCD Espanyol de Madrid"
    ]
  },
  {
    "dorsal": 69,
    "name": "Mateo",
    "position": "ED",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "RCD Espanyol de Madrid"
    ]
  },
  {
    "dorsal": 99,
    "name": "Arrufat, Diego",
    "position": "MCO",
    "captain": true,
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "2025–actualidad · Bisontes DUX",
      "A.D.C. Malasaña",
      "RCD Espanyol de Madrid"
    ]
  }
];
