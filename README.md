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
2. Install Git LFS once on the machine if needed, then run `git lfs pull` in this repo so `assets/source` contains real PDFs instead of pointer files.
3. Run `npm install` once to install the local PDF preview dependency used by moderator mode.
4. Install the recommended extensions: Live Server and Prettier.
5. Right-click `index.html` and choose **Open with Live Server**.
6. Edit `js/regions.js` for atlas content, `css/style.css` for presentation, and `js/app.js` for interaction.
7. Keep the production bundle out of the edit loop. It is generated from the source files when you are ready to export.

Note: moderator PDF preview is not reliable when the atlas is opened directly from `file://` inside embedded browsers. Use Live Server or run `python -m http.server 8010` from the repo root and open `http://127.0.0.1:8010/` in a normal browser when you need to inspect uploaded PDFs.

For the AI explanation MVP, prefer the local atlas server instead of `python -m http.server`:

```powershell
$env:ATLAS_AI_API_KEY = "your-key"
python tools/serve_atlas.py --port 8010
```

The local atlas server also auto-loads `.env` and accepts `OPENAI_API` or `OPENAI_API_KEY` as aliases for `ATLAS_AI_API_KEY`.

Optional environment variables:

1. `ATLAS_AI_MODEL` to override the default model name.
2. `ATLAS_AI_BASE_URL` to point at a compatible OpenAI-style endpoint.
3. `ATLAS_AI_CHAT_PATH` to override the default `/chat/completions` path.
4. `ATLAS_AI_TIMEOUT` to change the upstream timeout in seconds.

The MVP AI flow stays focused on climate-related map pages in the library viewer. It sends the current rendered page image plus extracted page text to the local proxy, which keeps the API key out of the browser.

If you keep serving the atlas from a different local server or port, set `window.ATLAS_CONFIG.aiEndpoint` before `js/app.js` loads so the browser posts to the AI proxy you actually started.

## Adding another atlas type

The app still supports multiple atlas collections in `js/regions.js` through
`window.ATLASES`, although the public evidence-library interface currently hides
the atlas selector to keep the kiosk workflow focused.

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

1. A cover scene introduces the offline evidence library.
2. A searchable contents scene shows report thumbnails and opens reports in the PDF viewer.
3. A dedicated climate maps scene groups visual climate-change maps by source collection.
4. A source library scene indexes the uploaded `assets/source` PDFs for reports,
   regional maps, thematic maps, and climate chapter pages.
5. The library viewer now includes an **Explain page** action for climate-related maps, plus separate page notes.

Core controls:

1. Use **Browse reports** or the top-bar **Contents** button to open the report thumbnail grid.
2. Use **Climate maps** to review visual climate-change maps such as temperature trends, precipitation, snow cover, water deficit, solar radiation, and growing-season indicators.
3. Use the top-bar **Library** button or press `L` to filter source PDFs, preview pages, zoom the PDF canvas, open the original file, and write local notes per report or map.
4. Search terms such as `NDC 3.0`, `GHG`, and `emissions reduction` surface the NDC ambition and implementation reports.
5. For climate map pages in the library, press `E` or click **Explain page** to generate an English explanation of the current page.
6. Use `F` for fullscreen and `Esc` to close overlays.

Moderator tools are hidden by default while the public evidence-library workflow is being finalized. To re-enable them for internal editing, set `window.ATLAS_CONFIG.showModerator = true` before `js/app.js` loads.

## Source PDF library

The library data is generated from the uploaded `assets/source` folder:

```powershell
git lfs pull
python tools/build_source_library.py
```

This writes `js/source-library.js`, which the app loads before `js/app.js`.
The library keeps report/map notes in browser local storage under
`atlasSourceLibraryNotesV1`, so notes are available offline in the same browser
profile. If the PDFs in `assets/source` are still tiny text pointer files, the
generator now stops with a Git LFS warning instead of writing a broken library.

For inline PDF previews, serve the project over local HTTP:

```powershell
python -m http.server 8010 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8010/`. The generated `dist/uzbekistan-atlas.html`
also works from the repo when `assets/source` remains beside `dist`.

For AI-enabled local use, replace that with:

```powershell
$env:ATLAS_AI_API_KEY = "your-key"
python tools/serve_atlas.py --port 8010
```

That server still serves the static atlas, and it also exposes `POST /api/explain-page` plus `GET /api/ai-status`.

## Moderator workflow

The atlas now includes a moderator workspace for content handoff.

1. Open **Moderator** from the top bar.
2. Choose an existing plate or use **Add plate** to create a new draft-only plate directly in the editor.
3. Attach the source PDF for that plate, write a caption, and update the long description.
4. For a new plate, fill in the plate title, type, scale label, and target map path before saving.
5. Use **Connect save folder** before expecting disk-backed moderator saves. You can choose the atlas repo root, `pdfs/moderator-library`, `pdfs/moderator-library/atlas-previews`, the current atlas folder such as `pdfs/moderator-library/atlas-previews/<atlasId>/`, a single plate package, or an empty project workspace folder.
6. When you choose a PDF in a Chromium browser over local HTTP and a save folder is connected, the atlas copies it into that plate's package folder and writes a `latest.json` description beside it.
7. If you connected the atlas repo root, the package is written under `pdfs/moderator-library/atlas-previews/<atlasId>/<plateId>/`, timestamped history snapshots are kept under `pdfs/moderator-library/draft-history/`, and `pdfs/moderator-library/atlas-project-memory.json` is updated.
8. If you connected the current atlas folder directly, the app writes straight into `<connected-folder>/<plateId>/` and keeps the plate package there without trying to claim a different repo-relative parent folder. If you connected an empty project workspace, the app creates `atlas-previews/<atlasId>/<plateId>/` plus archive metadata inside that workspace.
9. When project archiving is unavailable, the browser-only fallback now stores a smaller preview copy so integration can still complete in the current browser profile.
10. Use **Integrate into atlas** to save the currently rendered PDF page as a moderator atlas plate preview. When a save folder is connected, the preview JPG is written beside the plate's copied PDF and `latest.json` record inside that plate package folder.
11. If the source PDF is no longer attached in the current browser session, the atlas now tries to reuse an existing project copy from `projectPdfPath` so integration can still rebuild the dedicated plate folder. If no project copy is available, re-attach the source PDF before expecting it to be copied there.
12. Save the draft to refresh the current plate JSON record and manifest after text edits.
13. Use **Delete plate** to remove a draft-only custom plate from the active atlas while keeping its archived project history when project access was available.
14. Export the handoff JSON and give it together with the original PDF files to your associate.

The moderator workspace can now be entered directly from the cover scene with **Open moderator**, which is useful when the atlas is being used as an editing tool rather than a public kiosk.

The integrated atlas plate is a moderator-side raster preview captured from the PDF page you are viewing. It is useful for review and handoff, but the final production workflow should still replace it with a curated JPG export in `assets/maps/`.

Persistence details:

1. Saved moderator drafts are still cached in the browser under local storage key `atlasModeratorDraftsV2`, but large integrated previews are now written to project files instead of being kept only in browser storage.
2. Those browser-local drafts are still machine- and browser-profile-specific; use the project archive or exported handoff JSON for anything you do not want to lose.
3. Every archived plate now gets a current JSON description file at `pdfs/moderator-library/atlas-previews/<atlasId>/<plateId>/latest.json`, while timestamped history snapshots are still kept under `pdfs/moderator-library/draft-history/<atlasId>/<plateId>/`.
4. Integrated atlas previews are written to `pdfs/moderator-library/atlas-previews/`, which avoids the previous browser storage quota error for large preview images.
5. `pdfs/moderator-library/atlas-project-memory.json` now tracks the current project PDF path, current draft record path, and current archived preview path for each draft.
6. Project archiving uses the browser File System Access API, so it works best in a Chromium browser opened over local HTTP such as `http://127.0.0.1:8010/`, and it expects you to choose the repo root or its `pdfs/` folder when prompted.

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
