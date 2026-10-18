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
      "Malasaña",
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
      "Castellón",
      "A.D.C. Malasaña",
      "Cantera F.C.",
      "2025–actualidad · Bisontes DUX"
    ],
    "bio": "Jose lleva décadas en el fútbol base. Comenzó su carrera en Castellón, su ciudad natal, y más tarde se mudó a Madrid, donde dejó el fútbol por un tiempo. Después regresó a los campos: primero como entrenador, luego como directivo y, finalmente, cerrando el ciclo otra vez como jugador. Actualmente es delantero en el Cantera F.C. y uno de los entrenadores de Bisontes Dux. Fuera del campo, trabaja en su propio estudio, La Palma 52 Sound, como director de sonido para películas y series. Además, es uno de los fundadores y el presidente de la Asociación Tod@s Juegan."
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
      "Malasaña",
      "Cantera F.C.",
      "2025–actualidad · Bisontes DUX"
    ],
    "bio": "Fabio es el responsable de las redes sociales y la web de Bisontes Dux. Tiene experiencia de éxito tanto de jugador como de Community Manager. Dejó de jugar la temporada pasada en los Bisontes, aunque hay rumores de que podría volver a competir. Es de Cerdeña (Italia), pero lleva mucho tiempo viviendo en Madrid, donde estudia Informática y muestra un gran interés por el emprendimiento."
  },
  {
    "dorsal": 1,
    "name": "Copa Moreno, Omar Alejandro",
    "position": "POR",
    "trajectory": [
      "Malasaña",
      "Betis San Isidro",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Alejo",
    "bio": "Alejo es el portero de Bisontes Dux y un especialista en tapar penaltis. Tras haber dejado el fútbol hace unos años, una gran oferta le convenció para sumarse a este proyecto. Actualmente afronta su segunda temporada en el club, donde estamos seguros de que seguirá rindiendo al máximo nivel"
  },
  {
    "dorsal": 3,
    "name": "Navas Moreno, Bruno",
    "position": "DFC",
    "captain": true,
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Malasaña",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Bruno",
    "bio": "Bruno es un central contundente, líder de nuestra defensa, y uno de los capitanes del equipo. Destaca por su velocidad, su dominio del juego aéreo y la fuerza de sus entradas. Aunque parezca que no, siempre llega a robar el balón al rival o tapar su disparo. Llega tras convertirse en un auténtico referente durante sus años en el Malasaña. Dato curioso: su padre trabaja con Ben en Accenture."
  },
  {
    "dorsal": 4,
    "name": "Arias-Camisón Nieto, Miguel",
    "position": "MC",
    "nickname": "Miguelín",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Munibar Pizarrales",
      "Malasaña",
      "25/26–actualidad · Bisontes DUX"
    ],
    "bio": "Miguelín fichó por los Bisontes a mediados de la temporada 2025/26, después de disputar la primera parte del año en el Malasaña. Originario de Salamanca, Miguel viene de jugar unos años en el Munibar Pizarrales. Es un mediocampista ágil con buena visión de juego, y metió un hat-trick en su debut con nuestro equipo. En su tiempo libre, le puedes encontrar con sus amigos o en Las Ventas viendo una corrida."
  },
  {
    "dorsal": 5,
    "name": "Tagara Zombilla, Leonardo Jose",
    "position": "LI",
    "nationalities": [
      "España",
      "Filipinas"
    ],
    "trajectory": [
      "Malasaña",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Tagara",
    "bio": "Tagara es un lateral o extremo con mucha rapidez y buen ojo para la portería. Lleva años jugando con José y Ben en el Malasaña, y este año ha fichado por el Bisontes. Estamos encantados de tenerlo en el equipo y con muchas ganas de ver todo lo que va a aportar."
  },
  {
    "dorsal": 6,
    "name": "Arrango Guerra, Jose Anthony",
    "position": "MC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Malasaña",
      "Getafe",
      "San Cristobál",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Jose Anthony"
  },
  {
    "dorsal": 7,
    "name": "Gálvez Patiño, Alan",
    "position": "EI",
    "nationalities": [
      "Colombia"
    ],
    "trajectory": [
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Alan"
  },
  {
    "dorsal": 8,
    "name": "Alsonso Franco, Anton",
    "position": "MC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Canal",
      "RCD Espanyol de Madrid",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Anton"
  },
  {
    "dorsal": 9,
    "name": "Lomander Rivela, Max Lennart",
    "position": "DC",
    "nationalities": [
      "España",
      "Países Bajos"
    ],
    "trajectory": [
      "Periso CF",
      "RCD Espanyol de Madrid",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Max"
  },
  {
    "dorsal": 10,
    "name": "Tekiela, Filip Gabriel",
    "position": "DC",
    "captain": true,
    "nationalities": [
      "Polonia"
    ],
    "trajectory": [
      "Malasaña",
      "Factory FC",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Filip"
  },
  {
    "dorsal": 11,
    "name": "Salas, Luis Daniel",
    "position": "ED",
    "nationalities": [
      "Venezuela"
    ],
    "trajectory": [
      "Malasaña",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "LuisDa"
  },
  {
    "dorsal": 12,
    "name": "Garcia Villalba, Josshua Javier",
    "position": "ED",
    "trajectory": [
      "Malasaña",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Javi",
    "nationalities": [
      "Paraguay",
      "España"
    ]
  },
  {
    "dorsal": 14,
    "name": "Rivera Puente, Carlos Raul",
    "position": "DFC",
    "nationalities": [
      "Ecuador"
    ],
    "trajectory": [
      "A.D.C. Malasaña",
      "Cantera F.C.",
      "Fundación Rayo Vallecano",
      "Factory FC",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Carlitos"
  },
  {
    "dorsal": 15,
    "name": "Constantine Padilla, Arturo",
    "position": "EI",
    "nickname": "Arturito",
    "trajectory": [
      "Malasaña",
      "25/26–actualidad · Bisontes DUX"
    ]
  },
  {
    "dorsal": 17,
    "name": "Chavez Guzman, Cristhofer Alejandro",
    "position": "ED",
    "trajectory": [
      "CD Tajamar",
      "Factory FC",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Cris"
  },
  {
    "dorsal": 20,
    "name": "Morales Leiva, Izan",
    "position": "MC",
    "nationalities": [
      "Colombia"
    ],
    "trajectory": [
      "Malasaña",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Izan"
  },
  {
    "dorsal": 21,
    "name": "Naharro Idec, Elías",
    "position": "LI",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Sport Villa de Vallecas",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Elías"
  },
  {
    "dorsal": 22,
    "name": "Comas Trillo-Figueroa, Mario",
    "position": "LD",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Malasaña",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Mario"
  },
  {
    "dorsal": 25,
    "name": "Molina Diaz, Francisco Javier",
    "position": "DFC",
    "nationalities": [
      "Venezuela"
    ],
    "trajectory": [
      "Malasaña",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Fran"
  },
  {
    "dorsal": 28,
    "name": "Cabrejos Ramirez, Rodrigo Leonardo",
    "position": "DFC",
    "trajectory": [
      "ADC San Fermín",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Leonardo"
  },
  {
    "dorsal": 33,
    "name": "Gonzalez, David",
    "position": "DFC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Malasaña",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Coronel"
  },
  {
    "dorsal": 42,
    "name": "Floria Sanchez, Daniel",
    "position": "DFC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Malasaña",
      "RCD Espanyol de Madrid",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Dani"
  },
  {
    "dorsal": 67,
    "name": "Lopez Lopez, Santiago",
    "position": "MC",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "RCD Espanyol de Madrid",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Santi"
  },
  {
    "dorsal": 69,
    "name": "Gonzalez Riagada, Mateo",
    "position": "ED",
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "RCD Espanyol de Madrid",
      "26/27–actualidad · Bisontes DUX"
    ],
    "nickname": "Mateo"
  },
  {
    "dorsal": 99,
    "name": "Arrufat Belloso, Diego",
    "position": "MCO",
    "captain": true,
    "nationalities": [
      "España"
    ],
    "trajectory": [
      "Malasaña",
      "25/26–actualidad · Bisontes DUX"
    ],
    "nickname": "Diego"
  }
];
