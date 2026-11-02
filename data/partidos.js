/**
 * PARTIDOS — BISONTES DUX
 * ------------------------
 * Lo rellena el panel /admin/partido/ (11 inicial, directo, historias).
 * No hace falta editarlo a mano. Cada partido guarda:
 *   id, rival, fecha ("AAAA-MM-DDTHH:MM"), campo, local (true/false),
 *   competicion, parte (minutos de cada parte), galeria (nombre del
 *   partido en la galería de fotos), estado (previa, primera, descanso,
 *   segunda, final), tiempos (inicio, descanso, reanuda, final),
 *   once ({ formacion, titulares[11], suplentes[], capitan }) y
 *   eventos (goles, tarjetas, penaltis, cambios de estado; un gol
 *   anulado lleva anulado: { motivo }).
 */

const partidos = [];
