# Digital Teaching Board

A browser-based classroom smart board for importing PDFs, annotating lessons, adding blank explanation pages, teaching math, rearranging pages, and exporting the finished work as a new PDF.

## Features

- Import PDF files locally in the browser with PDF.js.
- Render PDF pages to a canvas at high resolution.
- A clean board-first interface with one movable three-line menu button that opens or hides every tool panel.
- Page navigation with current page / total page count.
- Add blank whiteboard pages between existing PDF pages.
- Thumbnail page manager with select, duplicate, delete, insert-after, and drag-and-drop reorder.
- Pen, pencil, highlighter, eraser, brush size, colors, and custom color picker.
- Undo, redo, and clear annotations per page.
- Movable/resizable Fabric.js objects for shapes, text, equations, images, and math teaching tools.
- Shapes: line, arrow, rectangle, rounded rectangle, circle, ellipse, triangle, right triangle, polygon, star, arc, and coordinate axes/grid.
- Text boxes with font size, color, bold, italic, move, resize, and edit support.
- Equation entry with KaTeX-powered LaTeX parsing and common math symbols.
- Ruler, protractor-style overlay, compass/circle tool, grid paper, and coordinate plane tools.
- Zoom in/out, fit to screen, reset zoom, and select/pan mode.
- Export the full ordered document as a PDF with backgrounds and annotations merged.
- Privacy-first: PDFs are processed locally in the browser and are not uploaded to a server.

## Project Files

Place these files together in the same directory:

- `index.html` — application markup and library includes.
- `style.css` — responsive smart-board layout and controls.
- `script.js` — PDF rendering, Fabric.js whiteboard logic, page manager, and PDF export.
- `README.md` — this documentation.

The app currently loads PDF.js, Fabric.js, jsPDF, and KaTeX from public CDNs. To make the app work fully offline, download those library files, place them in a local `vendor/` directory, and update the `<script>` and `<link>` URLs in `index.html` to point at the local copies.

## Run Locally

Because browser PDF workers and canvas export behave best from an HTTP origin, run a local static server from this directory:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Use the App

1. Click **Import PDF** and choose a PDF from your device.
2. Drag the floating **☰** button anywhere convenient; tap it to show or hide all tools.
3. Use **Previous Page** / **Next Page** or thumbnails to navigate.
4. Select drawing tools, colors, and brush sizes to annotate.
5. Use **Add Blank Page** or thumbnail **+ after** buttons to insert explanation pages.
6. Use the shapes, text, equation, image, and math tool buttons to add teaching content.
7. Drag objects with **Select/Pan** enabled to move or resize them.
8. Drag thumbnails to reorder pages.
9. Click **Save / Export PDF** to download the completed document.

## Deploy to GitHub Pages

1. Commit these files to a GitHub repository.
2. Open the repository on GitHub.
3. Go to **Settings → Pages**.
4. Set **Source** to **Deploy from a branch**.
5. Select the branch containing the app and the root folder.
6. Save. GitHub Pages will provide a public URL after deployment.

## Notes

- The app is designed for modern desktop and Android browsers.
- On mobile, use **Select/Pan** when navigating to avoid accidental drawing.
- Exported PDF pages use each page's canvas dimensions and orientation so imported and blank pages keep their visual layout.
