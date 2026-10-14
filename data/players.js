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
 *   trajectory   → Trayectoria, de la etapa más antigua a la actual (OPCIONAL)
 *   bio      → Descripción breve (OPCIONAL)
 *   stats    → Estadísticas reales en formato { etiqueta: valor } (OPCIONAL)
 *   socials  → Redes en formato { instagram, x, tiktok, facebook } (OPCIONAL)
 *   nickname → Apodo (OPCIONAL). Es lo que va estampado en la espalda de la
 *              camiseta en la portada y en la ficha; si no hay, se usa el apellido.
 *   duties   → «Se encarga de»: tareas en el club, sobre todo para el staff (OPCIONAL)
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
 *       "2023–2025 · Club anterior",
 *       "2025–actualidad · Bisontes DUX"
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
      "A.D.C. Malasaña",
      "Cantera F.C.",
      "2025–actualidad · Bisontes DUX"
    ],
    "bio": "Ben es el fundador y director técnico de Bisontes Dux. Tras dejar atrás su etapa como jugador, que terminó en el Cantera FC, ahora se enfoca por completo en sacar lo mejor de los bisontes. Originario de Boston (EE. UU.), actualmente trabaja como consultor estratégico en Accenture y es uno de los fundadores de la Asociación Tod@s Juegan."
  },
  {
    "role": "entrenador",
    "name": "Arrufat, Jose Ignacio",
    "position": "ENTRENADOR",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Cantera F.C.",
      "A.D.C. Malasaña",
      "Castellón",
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "role": "directiva",
    "name": "Loi, Fabio",
    "position": "COMMUNITY MANAGER",
    "photo": "assets/jugador2.png",
    "nationalities": [
      "Italia"
    ],
    "duties": "Redes sociales y web del club",
    "trajectory": [
      "A.D.C. Malasaña",
      "Cantera F.C.",
      "2025–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 1,
    "name": "Copa, Alejandro",
    "position": "POR",
    "trajectory": [
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
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
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
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
      "A.D.C. Malasaña",
      "Munibar Pizarrales",
      "2025–actualidad · Bisontes DUX"
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
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
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
      "San Cristóbal",
      "A.D.C. Malasaña",
      "Getafe",
      "2025–actualidad · Bisontes DUX"
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
      "RCD Espanyol de Madrid",
      "2025–actualidad · Bisontes DUX"
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
      "RCD Espanyol de Madrid",
      "2025–actualidad · Bisontes DUX"
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
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
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
      "Cantera F.C.",
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
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
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
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
      "RCD Espanyol de Madrid",
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
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
      "RCD Espanyol de Madrid",
      "2025–actualidad · Bisontes DUX"
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
      "RCD Espanyol de Madrid",
      "2025–actualidad · Bisontes DUX"
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
      "RCD Espanyol de Madrid",
      "A.D.C. Malasaña",
      "2025–actualidad · Bisontes DUX"
    ]
  }
];
