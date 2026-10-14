/**
 * GALERÍA — conexión con Supabase
 * --------------------------------
 * Rellena estos dos valores con los de tu proyecto (Supabase →
 * Project Settings → API Keys). Cómo crearlo: supabase/README.md.
 *
 *   supabaseUrl → «Project URL», p. ej. https://abcdefgh.supabase.co
 *   supabaseKey → la clave «publishable» (sb_publishable_…) o, en
 *                 proyectos antiguos, la «anon public».
 *
 * Esta clave es pública a propósito: va en el navegador de todos.
 * Lo que protege las fotos privadas son las reglas de
 * supabase/galeria.sql. NUNCA pongas aquí la clave «secret» ni la
 * «service_role».
 *
 * Mientras estén vacíos, la galería muestra un aviso de «muy pronto».
 */
window.BISONTES_GALERIA = {
  supabaseUrl: '',
  supabaseKey: ''
};
