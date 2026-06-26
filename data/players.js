/**
 * PLANTILLA — BISONTES DUX
 * -------------------------
 * Cada jugador puede tener:
 *   name     → Nombre completo
 *   position → Posición (ej: "POR", "DFC", "MCO"...)
 *   dorsal   → Número de camiseta o "COACH"
 *   photo    → Ruta a la foto (OPCIONAL — si no se pone, se busca assets/jugadorN.png)
 *   age      → Edad (OPCIONAL)
 *   nationality → Nacionalidad (OPCIONAL)
 *   bio      → Descripción breve (OPCIONAL)
 *
 * Ejemplo:
 *   { dorsal: 10, name: "García, Juan", position: "Mediapunta" }
 *   { dorsal: "COACH", name: "Entrenador", position: "Entrenador", photo: "assets/coach.jpg" }
 */

const players = [
  { dorsal: "COACH", name: "Gunduz, Ben",       position: "ENTRENADOR",         photo: "assets/coach_ben.jpg"    },
  { dorsal: "COACH", name: "Chicaiza, Flavio",  position: "SEGUNDO ENTRENADOR", photo: "assets/coach_flavio.jpg" },
  { dorsal: 1,  name: "Copa, Alejandro",        position: "POR" },
  { dorsal: 2,  name: "Loi, Fabio",             position: "LI"  },
  { dorsal: 3,  name: "Navas, Bruno",           position: "DFC" },
  { dorsal: 4,  name: "Arias, Miguel",          position: "MC"  },
  { dorsal: 5,  name: "Ossama",                 position: "LD"  },
  { dorsal: 7,  name: "Galvez, Alan",           position: "EI"  },
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
