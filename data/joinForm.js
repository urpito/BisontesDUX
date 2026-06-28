/* ============================================================
   BISONTES DUX — joinForm.js
   --
   PREGUNTAS DEL FORMULARIO "QUIERO JUGAR"
   --
   Para AÑADIR una pregunta nueva: copia un bloque { ... } completo,
   pégalo en la lista y cambia sus valores. ¡Ya está, no toques nada más!
   Para QUITAR una pregunta: borra (o comenta con //) su bloque.
   Para REORDENAR: sube o baja los bloques.

   Cada pregunta admite:
     name        → identificador interno, sin espacios ni tildes.
                   Es el nombre con el que verás la respuesta en el email.
     label       → el texto que ve la persona encima del campo.
     type        → tipo de campo. Opciones:
                     "text"     texto corto
                     "email"    email (se valida solo)
                     "tel"      teléfono
                     "number"   número
                     "date"     fecha
                     "textarea" texto largo (varias líneas)
                     "select"   desplegable (requiere "options")
     placeholder → texto gris de ejemplo dentro del campo (opcional)
     required    → true si es obligatorio rellenarlo (opcional)
     full        → true para que ocupe el ancho completo de la fila (opcional)
     options     → SOLO para "select": lista de opciones a elegir
   ============================================================ */

const joinFormFields = [

  { name: 'nombre',   label: 'Nombre completo', type: 'text',  placeholder: 'Tu nombre y apellidos', required: true, full: true },

  { name: 'email',    label: 'Email',           type: 'email', placeholder: 'tu@email.com', required: true },

  { name: 'telefono', label: 'Teléfono',        type: 'tel',   placeholder: '600 000 000' },

  { name: 'posicion', label: 'Posición',        type: 'text',  placeholder: 'ej: Portero, Defensa central, Extremo derecho…', full: true },

  /* ──────────────────────────────────────────────────────────
     EJEMPLOS PARA EL FUTURO
     Quita las // del principio de las líneas para activarlos,
     o cópialos como plantilla para tus propias preguntas.
     ──────────────────────────────────────────────────────────

  { name: 'edad', label: 'Edad', type: 'number', placeholder: '18' },

  { name: 'experiencia', label: '¿Has jugado antes?', type: 'select', full: true,
    options: ['Sí, en equipo federado', 'Sí, a nivel amateur', 'No, pero quiero aprender'] },

  { name: 'pie', label: 'Pie dominante', type: 'select',
    options: ['Derecho', 'Izquierdo', 'Ambidiestro'] },

  { name: 'comentarios', label: 'Cuéntanos algo más', type: 'textarea',
    placeholder: 'Disponibilidad, experiencia, lo que quieras…', full: true },

  ────────────────────────────────────────────────────────── */

];
