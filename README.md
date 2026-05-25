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

## Adding another atlas type

The app can now switch between atlas collections from the header selector. Define those collections in `js/regions.js` through `window.ATLASES`.

Each atlas entry should include:

1. `id`: stable slug used for the selector and moderator handoff files.
2. `name`: label shown in the UI.
3. `overview`: optional cover metrics such as `riverCount`, `seaCount`, and custom labels.
4. `glossary`: glossary rows for that atlas.
5. `regions`: an array of plate objects using the same shape as the current `window.REGIONS` entries.

Example:

```js
window.ATLASES = [
	window.ATLASES[0],
	{
		id: "soils-land-use",
		name: "Soils and Land Use",
		overview: {
			plateLabel: "Plates",
			riverLabel: "Key Basins",
			seaLabel: "Reference Waters"
		},
		glossary: [
			{ term: "allyuvial", definition: "river-deposited sediment" }
		],
		regions: [
			{
				id: "soil-example",
				name: "Sample Plate",
				uz: "Namuna plastinka",
				type: "Soils and land use plate",
				scale: "1 : 500 000",
				caption: "Short contents caption.",
				map: "assets/maps/sample-plate.jpg",
				palette: ["#8c5a33", "#466f5d", "#d3ba73"],
				summary: "Long-form notes for the drawer.",
				themes: ["Soils", "Land use"],
				facts: []
			}
		]
	}
];
```

Moderator drafts, browser storage, and exported handoff JSON now keep an `atlasId`, so switch to the target atlas before importing or editing its drafts.

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
2. Choose an existing plate or use **Add plate** to create a new draft-only plate directly in the editor.
3. Attach the source PDF for that plate, write a caption, and update the long description.
4. For a new plate, fill in the plate title, type, scale label, and target map path before saving.
5. When you choose a PDF in a Chromium browser over local HTTP, the atlas now automatically copies it into `pdfs/moderator-library/` using the current **Project PDF name**, writes a plate JSON record into `pdfs/moderator-library/draft-history/`, and updates `pdfs/moderator-library/atlas-project-memory.json`.
6. Use **Integrate into atlas** to save the currently rendered PDF page as a moderator atlas plate preview. The preview is written into `pdfs/moderator-library/atlas-previews/` so it no longer depends on browser local storage size limits.
7. Save the draft to refresh the current plate JSON record and manifest after text edits.
8. Use **Delete plate** to remove a draft-only custom plate from the active atlas while keeping its archived project history when project access was available.
9. Export the handoff JSON and give it together with the original PDF files to your associate.

The moderator workspace can now be entered directly from the cover scene with **Open moderator**, which is useful when the atlas is being used as an editing tool rather than a public kiosk.

The integrated atlas plate is a moderator-side raster preview captured from the PDF page you are viewing. It is useful for review and handoff, but the final production workflow should still replace it with a curated JPG export in `assets/maps/`.

Persistence details:

1. Saved moderator drafts are still cached in the browser under local storage key `atlasModeratorDraftsV2`, but large integrated previews are now written to project files instead of being kept only in browser storage.
2. Those browser-local drafts are still machine- and browser-profile-specific; use the project archive or exported handoff JSON for anything you do not want to lose.
3. Every archived plate now gets a current JSON description file at `pdfs/moderator-library/draft-history/<atlasId>/<plateId>/latest.json` plus timestamped history snapshots in the same folder.
4. Integrated atlas previews are written to `pdfs/moderator-library/atlas-previews/`, which avoids the previous browser storage quota error for large preview images.
5. `pdfs/moderator-library/atlas-project-memory.json` now tracks the current project PDF path, current draft record path, and current archived preview path for each draft.
6. Project archiving uses the browser File System Access API, so it works best in a Chromium browser opened over local HTTP such as `http://127.0.0.1:8010/`.

To integrate a handoff back into the source project:

```powershell
python tools/apply_moderator_handoff.py path\to\moderator-handoff.json
python tools/extract_maps.py pdfs/moderator-library --output-dir assets/maps
python tools/build.py
```

Notes:

1. When the atlas is served over local HTTP, the browser can render a selected PDF preview during the current session and keep the original file available for open or download. Direct `file://` browsing may block that preview path in embedded browsers, even though the filename still records correctly.
2. The exported handoff JSON stores the text edits, archive metadata, and recorded PDF filenames; hand over the real PDF files alongside it unless you already staged them in `pdfs/moderator-library/`.
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
