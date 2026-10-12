---
name: Bisontes DUX
description: La web viste la equipación del club. Punto gris, ribete rosa y dorsales estampados.
colors:
  kit: "#545454"
  kit-deep: "#484848"
  kit-soft: "#5f5f5f"
  kit-line: "rgba(255,255,255,0.14)"
  white: "#FFFFFF"
  on-kit-2: "rgba(255,255,255,0.8)"
  pink: "#FFC8DD"
  pink-rib: "#F1B3CB"
  ink: "#161616"
  ink-soft: "#545454"
  paper: "#F5F5F5"
typography:
  display:
    fontFamily: "'Big Shoulders Display', 'Archivo', sans-serif"
    fontSize: "clamp(3.25rem, 9vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "0.005em"
  dorsal:
    fontFamily: "'Big Shoulders Display', 'Archivo', sans-serif"
    fontSize: "clamp(12rem, 26vw, 26rem)"
    fontWeight: 900
    lineHeight: 0.8
    letterSpacing: "-0.02em"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "'Big Shoulders Display', 'Archivo', sans-serif"
    fontSize: "clamp(2.75rem, 6vw, 5.5rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "0.01em"
  title:
    fontFamily: "'Big Shoulders Display', 'Archivo', sans-serif"
    fontSize: "1.55rem"
    fontWeight: 800
    lineHeight: 1
  body:
    fontFamily: "'Archivo', system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "'Archivo', system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 800
    letterSpacing: "0.1em"
    fontVariation: "'wdth' 110"
  button:
    fontFamily: "'Archivo', system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 800
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 112"
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
  pill: "999px"
  crest: "50%"
spacing:
  rib: "8px"
  grid-gap: "14px"
  nav-h: "72px"
  pad: "clamp(16px, 5vw, 80px)"
  section: "clamp(72px, 10vw, 136px)"
components:
  button-primary:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "0 28px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "0 28px"
    height: "52px"
  button-ghost-hover:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
  button-dark:
    backgroundColor: "{colors.kit}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "0 28px"
    height: "52px"
  button-dark-hover:
    backgroundColor: "{colors.ink}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "0 28px"
    height: "52px"
  button-outline-hover:
    backgroundColor: "{colors.kit}"
    textColor: "{colors.white}"
  dorsal-button:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    size: "52px"
  dorsal-button-pressed:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  filter-chip-pressed:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
  nav-cta:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  player-card:
    backgroundColor: "{colors.kit-soft}"
    rounded: "{rounded.md}"
  player-card-info:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    padding: "14px 16px 16px"
  kit-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "32px 28px 28px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
    height: "50px"
  input-field-focus:
    backgroundColor: "{colors.white}"
---

# Design System: Bisontes DUX

## Overview

**Creative North Star: "La equipación"**

La web entera viste la camiseta del club. El cuerpo es el punto gris de la tela, con una textura muy fina de puntadas en V; el cuello y los puños son un ribete de canalé rosa; los apellidos y los dorsales van estampados en blanco y en el rosa del escudo. Cada pieza de la interfaz se lee como una parte de la prenda: el header es el cuello, la portada es la espalda con el apodo o apellido, el panel de datos del club es la etiqueta cosida por dentro y las tarjetas de patrocinador son los parches.

La paleta la fijó el dueño y no se negocia: gris, blanco, el rosa del logo y el negro del trazo del escudo. El sistema alterna dos equipaciones: la primera, gris con textura, para presentar (portada, plantilla, valores, Instagram); la segunda, blanca y lisa, para leer (sobre nosotros, patrocinadores, quiero jugar). La densidad es la de una presentación de camiseta de club: tipografía de dorsal enorme y muy pesada, poco texto por bloque y mucho aire vertical entre secciones.

Rechaza explícitamente la portada por defecto de la categoría: hero oscuro con foto recortada, barra de cifras y rejilla de tarjetas iguales.

**Key Characteristics:**
- Fondo gris con textura de punto (`--knit`) en todas las secciones de la primera equipación.
- Ribete rosa de canalé de 8px (`--rib`) como costura entre header, secciones, tira de dorsales, etiqueta y footer.
- Apellidos y números en Big Shoulders Display 800/900, siempre en mayúsculas.
- Texto, etiquetas y botones en Archivo; las etiquetas se ensanchan con el eje de anchura (110–112%).
- Esquinas casi rectas (3–6px): prenda cortada, no burbujas.
- Interacción firma: la tira de dorsales del hero cambia jugador, apellido y número con una animación de «planchado».

## Colors

Una paleta textil de tres colores más el negro del escudo: gris de punto como cuerpo, blanco como segunda equipación y rosa como ribete y estampado.

### Primary
- **Rosa del escudo** (`pink`): el ribete y el estampado. Botón principal, CTA del menú, números de dorsal (tarjetas y ficha; la portada no lleva número), estado pulsado de la tira de dorsales, segunda línea del titular de portada, «DUX» en la marca, subrayados de enlaces (2–3px), anillo de foco y selección de texto.
- **Sombra del ribete** (`pink-rib`): solo dentro del canalé (`--rib`, franjas de 3px rosa y 2px sombra). Nunca suelto.

### Neutral
- **Punto gris** (`kit`): el cuerpo de la camiseta. Fondo de `body`, del hero y de las secciones grises; también botón oscuro y borde inferior de los campos de formulario.
- **Gris sombra de tejido** (`kit-deep`): header, menú móvil, tira de dorsales, sección de valores, newsletter y footer. Es la misma tela en la parte que queda a la sombra.
- **Gris panel** (`kit-soft`): paneles sobre el punto (tarjeta de jugador).
- **Hilo claro** (`kit-line`): separadores y bordes finos sobre gris (bordes de dorsales y filtros en reposo, divisores de valores y del menú).
- **Blanco** (`white`): texto sobre gris, fondo de la segunda equipación, pie de las tarjetas de jugador, tarjeta de perfil de Instagram.
- **Blanco atenuado** (`on-kit-2`): texto secundario sobre gris (entradillas, navegación en reposo, párrafos de valores y blog).
- **Trazo del escudo** (`ink`): texto sobre blanco y sobre rosa.
- **Gris de texto** (`ink-soft`): texto secundario sobre blanco; es el mismo valor que `kit`, usado como tinta.
- **Papel** (`paper`): fondo de la etiqueta cosida, de las tarjetas de patrocinador, de los campos de formulario y de las estadísticas de la ficha.

### Named Rules
**The Ribete Rule.** El rosa solo aparece como ribete (bandas `--rib`), botón principal, número de dorsal, estado pulsado y acento de texto o subrayado. Nunca como fondo de una sección a sangre: la camiseta es gris, el rosa es el cuello.

**The Dos Equipaciones Rule.** Una sección es gris con textura de punto o blanca lisa. No hay terceras superficies a sangre ni degradados de fondo.

## Typography

**Display Font:** Big Shoulders Display 800/900 (con Archivo y sans-serif de respaldo)
**Body Font:** Archivo, variable en anchura y peso (con system-ui de respaldo)

**Character:** Big Shoulders es la letra de dorsal: condensada, muy pesada, de estampado de camiseta. Archivo es el texto de la etiqueta: sobrio y legible, y se ensancha en etiquetas y botones para que se lean como bordado.

### Hierarchy
- **Display** (900, `clamp(3.25rem, 9vw, 6rem)`, interlineado 0.86): solo el titular de portada «BISONTES DUX», con la segunda línea en rosa.
- **Dorsal** (900, 5–7rem en tarjetas y hasta 20rem en la ficha; números tabulares; la portada no muestra dorsal): los números estampados. Siempre rosa sobre gris.
- **Headline** (800, `clamp(2.75rem, 6vw, 5.5rem)`, interlineado 0.92, `text-wrap: balance`): títulos de sección y H1 de subpáginas, en mayúsculas.
- **Title** (800, 1.55–2rem, interlineado 1): nombres en tarjetas de jugador, patrocinador y blog; apellido estampado sobre la espalda (con tracking amplio de 0.12em).
- **Body** (400, 1.0625rem, interlineado 1.65): párrafos limitados a 60–68ch; la entradilla de «sobre nosotros» sube a `clamp(1.2rem, 2vw, 1.45rem)`.
- **Label** (700–800, 0.7–0.85rem, tracking 0.08–0.12em, mayúsculas, anchura 110–112%): navegación, posiciones, campos de formulario, `dt` de la etiqueta y de la ficha, fechas del blog.

### Named Rules
**The Estampado Rule.** Big Shoulders se reserva para lo que iría impreso en una camiseta: nombres, números y titulares. Nunca para párrafos ni etiquetas pequeñas.

**The Sin Kicker Rule.** No hay etiquetas de antetítulo (eyebrow/kicker) encima de los titulares. El titular empieza la sección; la entradilla va debajo.

## Layout

Columna central de 1320px como máximo con márgenes laterales `pad` (16px en móvil, hasta 80px). Las secciones respiran con un ritmo vertical `section` (72–136px); la newsletter y valores en gris sombra usan un ritmo más corto (56–88px). El header es fijo, de 72px más el ribete de 8px (64px en móvil), y el scroll compensa esa altura.

El hero ocupa la pantalla: rejilla de 5/6 columnas con el texto a la izquierda y la espalda de la camiseta a la derecha (silueta de la prenda con cuello rosa, apodo o apellido estampado y jugador recortado delante; sin dorsal en la portada), y la tira de dorsales a todo el ancho abajo. En móvil (≤680px) se apila: texto, camiseta de 250–340px de alto y tira de dorsales en columna; las dos acciones quedan lado a lado.

Las rejillas de contenido son asimétricas (7/4 en «sobre nosotros», 4/7 en Instagram y Quiero jugar) y pasan a una columna a 1100px. La plantilla es una rejilla automática de tarjetas de mínimo 210px con huecos de 14px, y dos columnas fijas en móvil. Los valores y las oportunidades de patrocinio son tres columnas separadas por hilos, bajo una raya rosa de 3px, que se apilan a 860px. El menú pasa a desplegable a 1100px.

## Elevation & Depth

Profundidad de prenda sobre mesa: sombras ambientales suaves y difusas, nunca sombras duras desplazadas. El fondo es plano y la sensación de tela la da la textura de punto. Las piezas que se pueden tocar se levantan al pasar el ratón (2–4px hacia arriba) y su sombra crece; el jugador recortado del hero y de las tarjetas lleva una sombra proyectada (`drop-shadow`) que lo despega del dorsal.

### Shadow Vocabulary
- **Reposo de botón principal** (`0 6px 18px rgba(0,0,0,0.18)`, en hover `0 10px 24px rgba(0,0,0,0.22)`).
- **Tarjeta** (`0 8px 20px rgba(0,0,0,0.12)` con un filo claro interior de 1px; en hover `0 16px 32px rgba(0,0,0,0.22)`).
- **Pieza flotante** (`0 10px 28px rgba(0,0,0,0.22–0.25)`): pie de foto del hero, escudo del hero.
- **Header al hacer scroll** (`0 8px 24px rgba(0,0,0,0.25)`).
- **Ventana y ficha** (`0 20px 40px` a `0 24px 48px`, `rgba(0,0,0,0.2–0.3)`).

### Named Rules
**The Levantar Rule.** Las superficies están quietas en reposo; solo se levantan como respuesta a la interacción (hover) y vuelven a su sitio al pulsar.

## Shapes

Corte de prenda: esquinas casi rectas. 3px en botones, campos, dorsales y el pie de foto; 4px en tarjetas y paneles; 6px en la tarjeta de Instagram, la ficha de jugador y el bloque de contacto. Las únicas formas redondas son el escudo (círculo blanco detrás del logo) y los filtros de plantilla (píldora). Cuando una pieza lleva ribete arriba (etiqueta, patrocinador principal, panel de Instagram, cuerpo de la tarjeta de blog), la esquina superior es recta y solo se redondea abajo. Los campos de formulario tienen un borde inferior gris de 2px, como una costura, y solo redondean arriba.

## Components

### Buttons
Firmes y planos, con letra ensanchada de etiqueta.
- **Shape:** esquinas de 3px, alto mínimo 52px (48px en el hero móvil), borde de 2px.
- **Primary:** fondo rosa y texto negro de escudo, con la sombra de reposo. Uno por bloque como máximo.
- **Hover / Focus:** sube 2px; el principal pasa a blanco. Foco: contorno rosa de 3px con 3px de separación (negro sobre secciones blancas).
- **Ghost:** borde blanco al 75% sobre gris; en hover se rellena de blanco.
- **Dark / Outline:** para secciones blancas. Oscuro (gris de punto, pasa a negro) y contorno (borde gris, se rellena de gris).

### Chips
- **Style:** filtros de la plantilla, en píldora de 44px de alto, borde de hilo claro y texto de etiqueta.
- **State:** pulsado (`aria-pressed`) en blanco con texto negro; los filtros no usan el rosa, que se reserva para el dorsal pulsado.

### Cards / Containers
- **Tarjeta de jugador:** gris panel con textura, 4px; foto de 4:5 con el dorsal rosa gigante detrás del jugador recortado (o «ENT.» / iniciales del cargo para el staff, y el escudo si no hay foto) y pie blanco con nombre (title), posición (etiqueta) y enlace a la ficha subrayado en rosa en hover.
- **Etiqueta cosida (panel de datos):** papel, ribete arriba, raya negra de 3px abajo, escudo centrado y lista de datos con hilos separadores.
- **Patrocinador:** papel, 4px, todos del mismo ancho en una fila (rejilla automática de mínimo 190px); el principal se distingue por el ribete arriba, la etiqueta «Patrocinador principal» en negro y un logo algo mayor (84px frente a 72px). Si tiene web, la tarjeta entera enlaza a ella; no hay ventana emergente.
- **Internal Padding:** 14–32px según tamaño; la rejilla separa con 14px.

### Inputs / Fields
- **Style:** fondo papel, 50px de alto, borde inferior gris de 2px, esquinas de 3px solo arriba. Etiqueta encima en estilo label.
- **Focus:** el borde completo pasa a gris de punto y el fondo a blanco. En la newsletter (sobre gris) el foco es el contorno rosa.
- **Error:** borde inferior rojo (`#b3261e`) cuando el valor no es válido; los mensajes de estado pasan a rosa sobre gris sombra.

### Navigation
Header fijo en gris sombra con textura, cerrado por la banda de ribete (el cuello). Escudo en círculo blanco de 48px y marca en display con «DUX» en rosa. Enlaces en etiqueta ensanchada al 80% de blanco; en hover o página actual pasan a blanco con una raya rosa de 3px que crece desde la izquierda. Primero van los enlaces que bajan a secciones del index y, tras un hilo separador, las páginas propias; el último es la CTA rosa «Patrocina». A 1100px se convierte en botón hamburguesa y desplegable a todo el ancho con separadores de hilo. Pendiente: la etiqueta «Sponsors» (anglicismo) se mantiene hasta que el dueño decida.

### Tira de dorsales (componente firma)
Debajo del hero, sobre gris sombra y con ribete arriba: la etiqueta «Elige dorsal» y una fila de números de 52px (48 y 44px en pantallas pequeñas) con desplazamiento horizontal. Al tocar un número, la espalda de la camiseta cambia: el apodo o apellido se desvanece y desenfocan (0.18s), se cambian los datos y vuelven «planchados» desde un 114% de escala con desenfoque de 10px (0.5s), mientras el jugador entra subiendo 24px (0.55s), con la curva `cubic-bezier(0.16, 1, 0.3, 1)`. El número activo se muestra pulsado en rosa. Se maneja con flechas izquierda/derecha. Con `prefers-reduced-motion: reduce` el cambio es inmediato, sin animación.

## Do's and Don'ts

### Do:
- **Do** cerrar el header, abrir las secciones que cambian de equipación y cerrar el footer con la banda de ribete de 8px.
- **Do** poner la textura de punto en todo fondo gris (`kit`, `kit-deep`, `kit-soft`).
- **Do** estampar los dorsales en rosa y los apellidos en blanco, en Big Shoulders 800/900 y mayúsculas.
- **Do** ensanchar las etiquetas y botones de Archivo al 110–112% con tracking de 0.06–0.12em.
- **Do** subrayar los enlaces de texto en rosa (2–3px, separados 3–4px).
- **Do** respetar `prefers-reduced-motion` en toda transición de la tira de dorsales y en el scroll suave.

### Don't:
- **Don't** usar el rosa como fondo de una sección a sangre.
- **Don't** poner antetítulos (eyebrow/kicker) encima de los titulares.
- **Don't** introducir colores fuera de la paleta del club (gris, blanco, rosa del escudo y negro del trazo), salvo los colores de estado de formulario.
- **Don't** usar Big Shoulders para párrafos ni Archivo para dorsales y titulares.
- **Don't** redondear más allá de 6px salvo el escudo y los filtros en píldora.
- **Don't** construir la portada como hero oscuro con foto recortada, barra de cifras y rejilla de tarjetas iguales.
