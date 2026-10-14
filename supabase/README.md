# Galería de fotos con Supabase

La web es estática (GitHub Pages), así que las fotos y las cuentas de la galería viven en un
proyecto gratuito de [Supabase](https://supabase.com):

- **`/galeria/`** (pública): las fotos que un admin marca como **destacadas**.
- **`/galeria/privada/`**: hay que entrar con cuenta. Jugadores e invitados ven **todas** las
  fotos y pueden filtrar por partido, por jugador o «Solo mis fotos», y descargarlas.
- **Admins**: suben, editan, destacan y borran fotos, y deciden quién entra (también con
  fecha de fin, para accesos puntuales).

Los permisos los impone la base de datos (reglas RLS de `galeria.sql`), no la web: aunque
alguien manipule el JavaScript, sin acceso no puede ver ni subir nada privado.

## Puesta en marcha (una vez, ~10 minutos)

1. **Crear el proyecto.** En supabase.com → *Start your project* → entra con GitHub o con el
   correo del club → *New project*:
   - *Name*: `bisontes-dux`.
   - *Database Password*: genera una y guárdala en un sitio seguro (no hace falta para la web).
   - *Region*: **Central EU (Frankfurt)** u otra de la Unión Europea (lo exige la política
     de privacidad de la web).
   - *Plan*: Free.
2. **Preparar la base de datos.** *SQL Editor* → *New query* → pega **todo** `galeria.sql`
   → *Run*. Tiene que acabar sin errores. Se puede volver a ejecutar sin perder nada.
3. **Desactivar la confirmación por correo.** *Authentication* → *Sign In / Providers* →
   *Email* → desactiva **Confirm email** → *Save*.
   El correo gratuito de Supabase solo llega a los miembros del equipo del proyecto, así que
   los jugadores nunca recibirían el correo de confirmación. El filtro de seguridad es otro:
   toda cuenta nueva queda **pendiente** hasta que un admin la aprueba.
4. **Conectar la web.** *Project Settings* → *API Keys*. Copia la **Project URL** y la
   **Publishable key** (`sb_publishable_…`; en proyectos antiguos, la *anon public*) en
   `js/galeria-config.js` y publica. **Nunca** pongas ahí la *secret* ni la *service_role*.
5. **Hacerte admin.** Entra en `/galeria/privada/` → *Crear cuenta*. Después, en el
   *SQL Editor*, ejecuta (con tu correo):

   ```sql
   update public.gallery_members set role = 'admin' where email = 'TU_CORREO@gmail.com';
   ```

   Recarga la galería: verás las pestañas *Subir fotos* y *Accesos*. El resto de admins se
   nombran desde *Accesos*, sin volver a tocar SQL.

## Uso diario

- **Subir fotos** (admins): elige varias a la vez, pon el partido, la fecha y quién sale.
  Se reducen en el propio móvil u ordenador antes de subirlas (2048 px, sin datos de
  ubicación). Si marcas **Destacadas**, salen también en la galería pública.
- **Editar o borrar**: abre la foto → *Editar*. Ahí se corrige quién sale, se destaca o se
  quita de la pública, y se borra.
- **Jugadores**: crean su cuenta en `/galeria/privada/` eligiendo su nombre; en *Accesos*
  aparece como solicitud pendiente con su ficha ya marcada → *Aprobar*.
- **Acceso puntual** (una familia, un fotógrafo, un patrocinador): que cree su cuenta y
  apruébala como **Invitado** con **Acceso hasta**. Ese día deja de ver las fotos sola.
- **Contraseña olvidada**: en *Accesos* → *Poner contraseña nueva* y se la pasas en persona
  o por privado. Cada uno puede cambiarla luego en *Cambiar contraseña*.
- **Quitar acceso**: *Accesos* → *Quitar acceso* (se puede devolver desde *Sin acceso*).
- **Autorización de imagen**: destaca (haz públicas) solo fotos de jugadores que la hayan
  firmado. Si alguien pide retirar una foto, bórrala o quítala de la pública.

## Límites del plan gratuito

- 1 GB de fotos (unas 2.000 con el tamaño al que se reducen) y 5 GB de descargas al mes.
- Un proyecto gratuito **se pausa tras 7 días sin uso**. La Action *Galería despierta*
  (`.github/workflows/galeria-despierta.yml`) lo consulta cada 3 días para evitarlo. Si aun
  así se pausa, entra en Supabase y pulsa *Restore project*.
