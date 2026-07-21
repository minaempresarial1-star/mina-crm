# MINA CRM

CRM compartido para administrar prospección, seguimientos, responsables y citas desde computadora o teléfono.

## Enlaces públicos

- **Aplicación:** https://minaempresarial1-star.github.io/mina-crm/
- **Guía ejecutiva para Mario:** https://minaempresarial1-star.github.io/mina-crm/guia-mario.html

## Estructura

```text
mina-crm/
├── index.html              Interfaz principal y formularios
├── styles.css              Sistema visual y diseño responsive
├── guia-mario.html         Guía ejecutiva pública e imprimible
├── manifest.webmanifest    Instalación como aplicación web
├── sw.js                   Caché y funcionamiento sin conexión
├── icon.svg                Identidad de la aplicación
└── src/
    ├── app.js              Vistas e interacción del CRM
    ├── store.js            Acceso a la base compartida
    └── config.js           Configuración pública de conexión
```

La guía permanece en la raíz para conservar una URL pública corta y estable. Los archivos de lógica están agrupados en `src/`; los archivos necesarios para GitHub Pages permanecen en la raíz.

## Funciones

- panel “Hoy” con próximas acciones y vencidos;
- pipeline visual con arrastre en escritorio y cambio de etapa en móvil;
- captura de tarjetas desde la cámara del teléfono;
- responsables Alejandro, Mario o Ambos;
- calendario mensual y agenda diaria;
- creación de eventos en Google Calendar y exportación `.ics`;
- directorio con búsqueda y edición;
- sincronización de datos mediante Google Sheets y Apps Script.

## Datos y seguridad

- El repositorio público no contiene prospectos ni fotografías.
- La clave compartida no debe incluirse en código, documentación o commits.
- Los datos vivos se conservan en la hoja privada de Google Sheets.
- Google Calendar recibe eventos manualmente; no existe sincronización bidireccional.

## Publicación

GitHub Pages publica directamente la raíz de la rama `main`. Antes de actualizar:

1. validar la sintaxis de los archivos JavaScript;
2. revisar que no existan claves ni datos de prospectos versionados;
3. comprobar que la aplicación y la guía respondan correctamente en producción.

El backend canónico vive en el repositorio privado hermano
`../mina-crm-backend/`. Se despliega manualmente en el único proyecto de Google Apps
Script compartido. Publicar GitHub Pages no redespliega Apps Script.

## Clon de trabajo

La ubicación local canónica es:

`/Users/alejandrohuante/Desktop/MINA/proyectos/mina-crm`

No usar `mario-crm-app`: esa carpeta apunta al repositorio retirado
`alejandrohuante16-jpg/mina-operacion-patrimonial`.
