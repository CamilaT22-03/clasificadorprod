# Eco Clasificador

Cuenta botellas con la cámara, una foto o un video, las guarda en un inventario de este navegador y busca basureros y puntos de reciclaje cerca. Las imágenes no salen del dispositivo.

## Cómo funciona

- **Detección:** COCO-SSD (TensorFlow.js) corre en el navegador. Solo cuenta la clase `bottle` con al menos 0,50 de confianza; por debajo de 0,60 el resultado se marca como poco seguro.
- **Sin duplicados:** una botella que sigue a la vista no se vuelve a registrar.
- **Inventario:** se guarda en `localStorage` (`reciclaapp-inventario-v1`). Se puede editar la cantidad, borrar filas y descargar JSON o CSV.
- **Mapa:** Leaflet + OpenStreetMap. Busca en 1200 m con Overpass. Amarillo es basurero, verde es contenedor y azul es punto de reciclaje.
- **PWA:** se puede instalar en la pantalla de inicio (`manifest.webmanifest` y `service-worker.js`).

## Probar en local

La cámara y el mapa necesitan `http://`; no abras `index.html` con doble clic.

```
python -m http.server 8765
```

Abre <http://127.0.0.1:8765>.

## Publicar en GitHub Pages

1. Sube este repositorio a tu GitHub.
2. En **Settings → Pages**, elige **Source: GitHub Actions**.
3. El workflow `.github/workflows/pages.yml` publica el sitio en cada push a `main`.

## Estructura

```
index.html            página principal
styles.css            estilos
js/detector.js        cámara, foto, video y detección
js/inventario.js      inventario, JSON y CSV
js/mapa.js            mapa y búsqueda de puntos
manifest.webmanifest  datos de la PWA
service-worker.js     caché sin conexión
assets/icono.svg      icono
.github/workflows/    despliegue en Pages
```

## Autor

Adelia Camila Taceo
