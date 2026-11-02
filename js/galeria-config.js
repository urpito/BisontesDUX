/**
 * GALERÍA — conexión con la API propia de Bisontes DUX
 * -----------------------------------------------------
 * Las fotos, vídeos y cuentas viven en urpilandia (server/server.mjs),
 * bajo /api del mismo dominio. js/bisontes-api.js hace de cliente.
 * No hay ninguna clave aquí: la sesión va en una cookie del servidor.
 */
window.BISONTES_GALERIA = {
  supabaseUrl: '/api',
  supabaseKey: 'propia'
};
