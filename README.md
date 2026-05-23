# Uzbekistan Atlas

A kiosk-friendly static atlas for pavilion and showcase use. The app itself is plain HTML, CSS, and JavaScript. Python is only used for support tooling: extracting map images from PDFs and bundling the development files into a single offline HTML deliverable.

## Project structure

```text
uzbekistan-atlas/
├── index.html
├── css/style.css
├── js/app.js
├── js/regions.js
├── assets/maps/
├── assets/fonts/
├── pdfs/
├── tools/extract_maps.py
├── tools/build.py
├── dist/
│   └── uzbekistan-atlas.html
├── requirements.txt
└── README.md
```

## Development loop

1. Open the folder in VS Code.
2. Install the recommended extensions: Live Server and Prettier.
3. Right-click `index.html` and choose **Open with Live Server**.
4. Edit `js/regions.js` for text content, `css/style.css` for presentation, and `js/app.js` for interaction.
5. Keep the production bundle out of the edit loop. It is generated from the source files when you are ready to export.

## Python tooling

Create a virtual environment if you want one, then install the single dependency:

```powershell
python -m pip install -r requirements.txt
```

### Export PDF pages as JPG maps

Put source PDFs inside `pdfs/`, then run:

```powershell
python tools/extract_maps.py
```

Useful options:

```powershell
python tools/extract_maps.py "pdfs/O'zbekiston_Milliy_Atlasi_I_TOM.pdf" --dpi 260
python tools/extract_maps.py pdfs --output-dir assets/maps
```

The exporter writes JPG files into `assets/maps/`. Rename the curated outputs to match the filenames referenced in `js/regions.js`, or update `js/regions.js` to match your exported names.

### Build the single offline deliverable

```powershell
python tools/build.py
```

This writes the bundled kiosk file to `dist/uzbekistan-atlas.html`.

## Recommended workflow

1. Develop in the split source files.
2. Export or curate the map JPGs into `assets/maps/`.
3. Add offline font files to `assets/fonts/` if you want custom typography without network access.
4. Run `python tools/build.py` to produce the self-contained kiosk file.
5. Test the generated file directly in a browser before deployment.

## Git

Initialize version control once inside the project root:

```powershell
git init
```

Empty asset folders include `.gitkeep` placeholders so Git will preserve them.

## Notes

- The starter UI already handles missing map images and shows an on-screen fallback instead of breaking.
- `js/regions.js` ships with English placeholder content for all 14 administrative units, so you can start editing text immediately.
- The build script inlines CSS, JavaScript, fonts, and any referenced local assets into one HTML file when those assets exist.
