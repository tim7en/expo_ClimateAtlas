# Uzbekistan Atlas

An offline climate atlas for pavilion screens, kiosks, and local installs. The app itself is plain HTML, CSS, and JavaScript. Python is used for support tooling, and a small local npm dependency is used so moderator PDF uploads can be previewed reliably in the browser.

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
2. Run `npm install` once to install the local PDF preview dependency used by moderator mode.
3. Install the recommended extensions: Live Server and Prettier.
4. Right-click `index.html` and choose **Open with Live Server**.
5. Edit `js/regions.js` for atlas content, `css/style.css` for presentation, and `js/app.js` for interaction.
6. Keep the production bundle out of the edit loop. It is generated from the source files when you are ready to export.

Note: moderator PDF preview is not reliable when the atlas is opened directly from `file://` inside embedded browsers. Use Live Server or run `python -m http.server 8010` from the repo root and open `http://127.0.0.1:8010/` in a normal browser when you need to inspect uploaded PDFs.

## Atlas experience

The current scaffold now ships as a scene-based album UI:

1. A cover scene introduces the atlas.
2. An album scene shows one climate plate at a time with page-turn navigation.
3. A searchable contents scene lets users jump straight to a region.

Core controls:

1. Drag to pan the loaded map plate.
2. Scroll, double-click, or use the zoom controls to zoom.
3. Open **Map notes** for the climate and water summary plus glossary.
4. Use the top-bar **Contents** button or press `C` to open the searchable plate grid.
5. Use the cover-screen **Open moderator** button, the top-bar **Moderator** button, or press `M` to open the moderator workspace.
6. Use the arrow keys to move between plates, `I` to toggle notes, `F` for fullscreen, and `Esc` to close overlays.

## Moderator workflow

The atlas now includes a moderator workspace for content handoff.

1. Open **Moderator** from the top bar.
2. Choose a region.
3. Attach the source PDF for that region, write a caption, and update the long description.
4. Use **Integrate into atlas** to save the currently rendered PDF page as a moderator atlas plate preview.
5. Save the draft. The atlas preview immediately uses the saved text, and the draft is kept in local browser storage.
6. Export the handoff JSON and give it together with the original PDF files to your associate.

The moderator workspace can now be entered directly from the cover scene with **Open moderator**, which is useful when the atlas is being used as an editing tool rather than a public kiosk.

The integrated atlas plate is a moderator-side raster preview captured from the PDF page you are viewing. It is useful for review and handoff, but the final production workflow should still replace it with a curated JPG export in `assets/maps/`.

Persistence details:

1. Saved moderator drafts are stored in the browser under local storage key `atlasModeratorDraftsV1` until that browser storage is cleared.
2. Those local drafts are machine- and browser-profile-specific; they do not automatically travel with the HTML file.
3. For anything you do not want to lose, export the handoff JSON and/or apply it into `js/moderator-drafts.js` with the importer script.
4. PDF files themselves are not stored into the repo from the browser; only the recorded file name is kept in the draft data.

To integrate a handoff back into the source project:

```powershell
python tools/apply_moderator_handoff.py path\to\moderator-handoff.json
python tools/extract_maps.py pdfs --output-dir assets/maps
python tools/build.py
```

Notes:

1. When the atlas is served over local HTTP, the browser can render a selected PDF preview during the current session and keep the original file available for open or download. Direct `file://` browsing may block that preview path in embedded browsers, even though the filename still records correctly.
2. The exported handoff JSON stores the text edits and recorded PDF filenames; hand over the real PDF files alongside it.
3. If you use **Integrate into atlas**, the exported handoff JSON also carries the saved moderator atlas preview image so your associate can apply it into `js/moderator-drafts.js` before a final JPG export is ready.
4. The importer writes the draft data into `js/moderator-drafts.js`, which overlays the base atlas content without forcing you to edit `js/regions.js` manually.

## Python tooling

Create a virtual environment if you want one, then install the single dependency:

```powershell
python -m pip install -r requirements.txt
```

Install the local JavaScript dependency once as well:

```powershell
npm install
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

### Build a public offline deliverable without moderator tools

```powershell
python tools/build.py --public --output dist/uzbekistan-atlas-public.html
```

Public mode does two things:

1. Hides the moderator button, moderator scene, and `M` keyboard shortcut in the shipped bundle.
2. Ignores browser-local moderator drafts, so the public bundle only reflects the source data and any drafts already applied into `js/moderator-drafts.js`.

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

- The atlas UI handles missing map images and shows on-screen fallbacks in both the main plate and the contents grid.
- `js/regions.js` now ships with climate-and-water-focused placeholder content for all 14 administrative units.
- The build script inlines CSS, JavaScript, fonts, and any referenced local assets into one HTML file when those assets exist.
