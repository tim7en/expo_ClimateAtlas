const ATLAS_CONFIG = window.ATLAS_CONFIG || {};
const MODERATOR_DRAFTS = Array.isArray(window.MODERATOR_DRAFTS) ? window.MODERATOR_DRAFTS : [];
const PDFJS_LIB = window.pdfjsLib || null;
const MODERATOR_STORAGE_KEY = "atlasModeratorDraftsV2";
const LEGACY_MODERATOR_STORAGE_KEY = "atlasModeratorDraftsV1";
const MODERATOR_ENABLED = ATLAS_CONFIG.showModerator !== false;
const USE_BROWSER_DRAFTS = ATLAS_CONFIG.useBrowserDrafts !== false;
const MODERATOR_PDF_PREVIEW_MAX_SCALE = 2.25;
const MODERATOR_ATLAS_RENDER_MAX_SCALE = 4;
const MODERATOR_ATLAS_RENDER_MAX_WIDTH = 2200;
const MODERATOR_ATLAS_RENDER_MAX_HEIGHT = 3000;
const PROJECT_PDFS_FOLDER = "pdfs";
const MODERATOR_PROJECT_ARCHIVE_FOLDER = "moderator-library";
const MODERATOR_PROJECT_ARCHIVE_PATH = `${PROJECT_PDFS_FOLDER}/${MODERATOR_PROJECT_ARCHIVE_FOLDER}`;
const MODERATOR_PROJECT_MANIFEST_FILE = "atlas-project-memory.json";

function normalizeAtlasId(value, fallback = "atlas") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function normalizeAtlasCollection(rawAtlas, fallbackId = "atlas") {
  if (!rawAtlas || typeof rawAtlas !== "object") {
    return null;
  }

  const regions = Array.isArray(rawAtlas.regions) ? rawAtlas.regions : [];
  if (!regions.length) {
    return null;
  }

  const id = normalizeAtlasId(rawAtlas.id, fallbackId);

  return {
    id,
    name: String(rawAtlas.name || rawAtlas.label || id).trim() || id,
    glossary: Array.isArray(rawAtlas.glossary) ? rawAtlas.glossary : [],
    overview: rawAtlas.overview || {},
    regions
  };
}

function buildLegacyAtlasCollection() {
  return {
    id: normalizeAtlasId(ATLAS_CONFIG.defaultAtlasId || "climate-water", "climate-water"),
    name: String(ATLAS_CONFIG.defaultAtlasName || "Climate and Water").trim() || "Climate and Water",
    glossary: Array.isArray(window.ATLAS_GLOSSARY) ? window.ATLAS_GLOSSARY : [],
    overview: window.ATLAS_OVERVIEW || {},
    regions: Array.isArray(window.REGIONS) ? window.REGIONS : []
  };
}

const ATLAS_COLLECTIONS = (() => {
  const collections = Array.isArray(window.ATLASES)
    ? window.ATLASES
        .map((atlas, index) => normalizeAtlasCollection(atlas, `atlas-${index + 1}`))
        .filter(Boolean)
    : [];

  if (collections.length) {
    return collections;
  }

  const legacyAtlas = buildLegacyAtlasCollection();
  return legacyAtlas.regions.length ? [legacyAtlas] : [];
})();

let activeAtlas = null;
let REGIONS = [];
let ATLAS_GLOSSARY = [];
let ATLAS_OVERVIEW = {};
let INDEX_BY_ID = new Map();

function getAtlasById(atlasId) {
  return ATLAS_COLLECTIONS.find((atlas) => atlas.id === atlasId) || ATLAS_COLLECTIONS[0] || null;
}

function setActiveAtlasData(atlasId) {
  activeAtlas = getAtlasById(atlasId);
  REGIONS = activeAtlas?.regions || [];
  ATLAS_GLOSSARY = activeAtlas?.glossary || [];
  ATLAS_OVERVIEW = activeAtlas?.overview || {};
  INDEX_BY_ID = new Map(REGIONS.map((region, index) => [region.id, index]));
  return activeAtlas;
}

function getActiveAtlasId() {
  return activeAtlas?.id || "";
}

function getActiveAtlasName() {
  return activeAtlas?.name || "Atlas";
}

setActiveAtlasData(ATLAS_COLLECTIONS[0]?.id || "");

const ICONS = {
  terrain:
    '<path d="M3 18h18" /><path d="M4 18l5-6 4 4 7-9 0 11" stroke-linecap="round" stroke-linejoin="round" />',
  water:
    '<path d="M12 3c2.8 3.8 5 6.5 5 9.3a5 5 0 1 1-10 0C7 9.5 9.2 6.8 12 3Z" stroke-linejoin="round" /><path d="M9.2 14.2c0.7 0.9 1.7 1.3 2.8 1.3 1.2 0 2.2-0.4 2.9-1.3" stroke-linecap="round" />',
  climate:
    '<path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" stroke-linecap="round" /><circle cx="12" cy="12" r="4.2" />',
  focus:
    '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke-linejoin="round" /><circle cx="12" cy="12" r="2.5" />'
};

const state = {
  atlasId: getActiveAtlasId(),
  index: 0,
  started: false,
  currentScene: "cover",
  returnScene: "cover",
  query: "",
  animating: false,
  hintDismissed: false,
  mapReady: false,
  pendingMapId: null,
  moderatorDrafts: mergeDraftMaps(
    buildDraftMap(MODERATOR_DRAFTS, getActiveAtlasId()),
    USE_BROWSER_DRAFTS ? loadStoredDrafts(getActiveAtlasId()) : new Map()
  ),
  moderatorRegionId: REGIONS[0]?.id ?? "",
  moderatorPdfUrls: new Map(),
  moderatorSessionFiles: new Map(),
  moderatorPdfBytes: new Map(),
  moderatorPdfDocuments: new Map(),
  moderatorPdfPageByRegion: new Map(),
  moderatorPdfRenderToken: 0,
  projectArchiveRootHandle: null
};

const view = {
  scale: 1,
  fit: 1,
  x: 0,
  y: 0
};

const elements = {
  atlasSelect: document.querySelector("#atlas-select"),
  atlasCurrentName: document.querySelector("#atlas-current-name"),
  cover: document.querySelector("#cover"),
  album: document.querySelector("#album"),
  contents: document.querySelector("#contents"),
  moderator: document.querySelector("#moderator"),
  metricPlates: document.querySelector("#metric-plates"),
  metricPlatesLabel: document.querySelector("#metric-plates-label"),
  metricRivers: document.querySelector("#metric-rivers"),
  metricRiversLabel: document.querySelector("#metric-rivers-label"),
  metricSea: document.querySelector("#metric-sea"),
  metricSeaLabel: document.querySelector("#metric-sea-label"),
  btnBegin: document.querySelector("#btnBegin"),
  btnOpenModerator: document.querySelector("#btnOpenModerator"),
  btnContents: document.querySelector("#btnContents"),
  btnModerator: document.querySelector("#btnModerator"),
  btnFull: document.querySelector("#btnFull"),
  fullLabel: document.querySelector("#full-label"),
  plate: document.querySelector("#plate"),
  pNum: document.querySelector("#pNum"),
  pName: document.querySelector("#pName"),
  pUz: document.querySelector("#pUz"),
  pTypeA: document.querySelector("#pTypeA"),
  pTypeB: document.querySelector("#pTypeB"),
  cName: document.querySelector("#cName"),
  cIdx: document.querySelector("#cIdx"),
  cTotal: document.querySelector("#cTotal"),
  prev: document.querySelector("#prev"),
  next: document.querySelector("#next"),
  filmstrip: document.querySelector("#filmstrip"),
  viewport: document.querySelector("#viewport"),
  mapImage: document.querySelector("#map-img"),
  mapPlaceholder: document.querySelector("#map-placeholder"),
  placeholderTitle: document.querySelector("#placeholder-title"),
  placeholderCopy: document.querySelector("#placeholder-copy"),
  hint: document.querySelector("#hint"),
  scaleTag: document.querySelector("#sTag"),
  zoomIn: document.querySelector("#zIn"),
  zoomOut: document.querySelector("#zOut"),
  zoomFit: document.querySelector("#zFit"),
  btnNotes: document.querySelector("#btnNotes"),
  scrim: document.querySelector("#scrim"),
  drawer: document.querySelector("#drawer"),
  drClose: document.querySelector("#drClose"),
  drEk: document.querySelector("#drEk"),
  drName: document.querySelector("#drName"),
  drUz: document.querySelector("#drUz"),
  drSummary: document.querySelector("#drSummary"),
  drFacts: document.querySelector("#drFacts"),
  drGloss: document.querySelector("#drGloss"),
  contentsSubtitle: document.querySelector("#contents-subtitle"),
  contentsSearch: document.querySelector("#contents-search"),
  contentsCount: document.querySelector("#contents-count"),
  contentsGrid: document.querySelector("#cgrid"),
  cClose: document.querySelector("#cClose"),
  moderatorBack: document.querySelector("#moderator-back"),
  moderatorForm: document.querySelector("#moderator-form"),
  moderatorRegion: document.querySelector("#moderator-region"),
  moderatorPdf: document.querySelector("#moderator-pdf"),
  moderatorProjectPdfName: document.querySelector("#moderator-project-pdf-name"),
  moderatorFileMeta: document.querySelector("#moderator-file-meta"),
  moderatorPreviewHint: document.querySelector("#moderator-preview-hint"),
  moderatorCaption: document.querySelector("#moderator-caption"),
  moderatorSummary: document.querySelector("#moderator-summary"),
  moderatorNote: document.querySelector("#moderator-note"),
  moderatorArchive: document.querySelector("#moderator-archive"),
  moderatorIntegrate: document.querySelector("#moderator-integrate"),
  moderatorPreview: document.querySelector("#moderator-preview"),
  moderatorReset: document.querySelector("#moderator-reset"),
  moderatorExport: document.querySelector("#moderator-export"),
  moderatorImport: document.querySelector("#moderator-import"),
  moderatorPdfStage: document.querySelector("#moderator-pdf-stage"),
  moderatorPdfEmpty: document.querySelector("#moderator-pdf-empty"),
  moderatorPdfRender: document.querySelector("#moderator-pdf-render"),
  moderatorPdfCanvas: document.querySelector("#moderator-pdf-canvas"),
  moderatorPdfPage: document.querySelector("#moderator-pdf-page"),
  moderatorPdfPrev: document.querySelector("#moderator-pdf-prev"),
  moderatorPdfNext: document.querySelector("#moderator-pdf-next"),
  moderatorPdfAccess: document.querySelector("#moderator-pdf-access"),
  moderatorPdfName: document.querySelector("#moderator-pdf-name"),
  moderatorPdfCopy: document.querySelector("#moderator-pdf-copy"),
  moderatorPdfOpen: document.querySelector("#moderator-pdf-open"),
  moderatorPdfDownload: document.querySelector("#moderator-pdf-download"),
  moderatorCommand: document.querySelector("#moderator-command"),
  moderatorStatus: document.querySelector("#moderator-status"),
  moderatorDraftList: document.querySelector("#moderator-draft-list")
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return entities[character] || character;
  });
}

function clampChannel(channel) {
  return Math.max(0, Math.min(255, channel));
}

function getModeratorPreviewEnvironmentHint() {
  if (window.location.protocol === "file:") {
    return "Direct file-open mode can block uploaded PDF preview in embedded browsers. For moderator PDF preview, open the atlas through Live Server or run `python -m http.server 8010` and use http://127.0.0.1:8010/ in a normal browser.";
  }

  return "";
}

function syncModeratorPreviewHint() {
  if (!elements.moderatorPreviewHint) {
    return;
  }

  const hint = getModeratorPreviewEnvironmentHint();
  elements.moderatorPreviewHint.hidden = !hint;
  elements.moderatorPreviewHint.textContent = hint;
}

function shadeHexColor(hexColor, percent) {
  const normalized = String(hexColor || "").trim().replace(/^#/, "");

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return "#8e4524";
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const offset = Math.round(255 * percent);

  return `#${[red, green, blue]
    .map((channel) => clampChannel(channel + offset).toString(16).padStart(2, "0"))
    .join("")}`;
}

function normalizeDraft(rawDraft, atlasId = getActiveAtlasId()) {
  if (!rawDraft || typeof rawDraft !== "object") {
    return null;
  }

  const draftAtlasId = normalizeAtlasId(rawDraft.atlasId || atlasId || getActiveAtlasId(), atlasId || "atlas");
  const regionId = String(rawDraft.regionId || rawDraft.id || "").trim();
  if (!regionId || draftAtlasId !== atlasId || !INDEX_BY_ID.has(regionId)) {
    return null;
  }

  const normalized = {
    atlasId: draftAtlasId,
    regionId,
    caption: String(rawDraft.caption || "").trim(),
    summary: String(rawDraft.summary || "").trim(),
    moderatorNote: String(rawDraft.moderatorNote || rawDraft.note || "").trim(),
    sourcePdf: String(rawDraft.sourcePdf || rawDraft.pdfName || "").trim(),
    sourceFileSize: String(rawDraft.sourceFileSize || "").trim(),
    projectPdfName: String(rawDraft.projectPdfName || rawDraft.projectPdfFileName || "").trim(),
    projectPdfPath: String(rawDraft.projectPdfPath || "").trim(),
    projectPdfSavedAt: String(rawDraft.projectPdfSavedAt || "").trim(),
    atlasPreviewImage: String(rawDraft.atlasPreviewImage || rawDraft.atlasPlateImage || "").trim(),
    atlasPreviewPage: Number.isFinite(Number(rawDraft.atlasPreviewPage))
      ? Math.max(1, Math.round(Number(rawDraft.atlasPreviewPage)))
      : 0,
    updatedAt: String(rawDraft.updatedAt || "").trim()
  };

  return normalized;
}

function buildDraftMap(drafts, atlasId = getActiveAtlasId()) {
  const draftMap = new Map();

  (drafts || []).forEach((draft) => {
    const normalized = normalizeDraft(draft, atlasId);

    if (normalized) {
      draftMap.set(normalized.regionId, normalized);
    }
  });

  return draftMap;
}

function mergeDraftMaps(baseMap, overrideMap) {
  const merged = new Map(baseMap || []);

  Array.from(overrideMap || []).forEach(([regionId, draft]) => {
    merged.set(regionId, draft);
  });

  return merged;
}

function serializeDraftMap(draftMap) {
  return Array.from(draftMap.values()).sort((left, right) => {
    const leftIndex = INDEX_BY_ID.get(left.regionId) ?? 0;
    const rightIndex = INDEX_BY_ID.get(right.regionId) ?? 0;
    return leftIndex - rightIndex;
  });
}

function readStoredDraftPayload() {
  if (!USE_BROWSER_DRAFTS) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(MODERATOR_STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_MODERATOR_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        [ATLAS_COLLECTIONS[0]?.id || "atlas"]: parsed
      };
    }

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadStoredDrafts(atlasId = getActiveAtlasId()) {
  const payload = readStoredDraftPayload();
  const drafts = Array.isArray(payload) ? payload : payload?.[atlasId];
  return buildDraftMap(Array.isArray(drafts) ? drafts : [], atlasId);
}

function persistDrafts() {
  if (!USE_BROWSER_DRAFTS) {
    return;
  }

  const payload = readStoredDraftPayload();
  const nextPayload = Array.isArray(payload) ? {} : { ...payload };
  nextPayload[getActiveAtlasId()] = serializeDraftMap(state.moderatorDrafts);
  window.localStorage.setItem(MODERATOR_STORAGE_KEY, JSON.stringify(nextPayload));
}

function slugifyProjectPdfName(value) {
  return String(value || "")
    .trim()
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProjectPdfFileName(value, regionId) {
  const slug = slugifyProjectPdfName(value) || slugifyProjectPdfName(regionId) || "region-source";
  return `${slug}.pdf`;
}

function buildProjectArchiveManifest(draftMap) {
  return {
    version: 1,
    atlasId: getActiveAtlasId(),
    atlasName: getActiveAtlasName(),
    updatedAt: new Date().toISOString(),
    archiveFolder: MODERATOR_PROJECT_ARCHIVE_PATH,
    drafts: serializeDraftMap(draftMap).map((draft) => {
      const region = REGIONS[INDEX_BY_ID.get(draft.regionId)];

      return {
        atlasId: draft.atlasId || getActiveAtlasId(),
        regionId: draft.regionId,
        regionName: region?.name || draft.regionId,
        sourcePdf: draft.sourcePdf || "",
        sourceFileSize: draft.sourceFileSize || "",
        projectPdfName: draft.projectPdfName || "",
        projectPdfPath: draft.projectPdfPath || "",
        projectPdfSavedAt: draft.projectPdfSavedAt || "",
        caption: draft.caption || "",
        summary: draft.summary || "",
        moderatorNote: draft.moderatorNote || "",
        atlasPreviewPage: draft.atlasPreviewPage || 0,
        atlasPreviewSaved: Boolean(draft.atlasPreviewImage),
        updatedAt: draft.updatedAt || ""
      };
    })
  };
}

async function getProjectArchiveDirectoryHandle() {
  if (typeof window.showDirectoryPicker !== "function") {
    return null;
  }

  if (!state.projectArchiveRootHandle) {
    state.projectArchiveRootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  }

  const rootHandle = state.projectArchiveRootHandle;
  const rootName = String(rootHandle?.name || "").trim().toLowerCase();

  if (rootName === MODERATOR_PROJECT_ARCHIVE_FOLDER) {
    return rootHandle;
  }

  const pdfsHandle = rootName === PROJECT_PDFS_FOLDER
    ? rootHandle
    : await rootHandle.getDirectoryHandle(PROJECT_PDFS_FOLDER, { create: true });

  return pdfsHandle.getDirectoryHandle(MODERATOR_PROJECT_ARCHIVE_FOLDER, { create: true });
}

async function writeProjectArchiveManifest(archiveHandle, draftMap) {
  const manifestHandle = await archiveHandle.getFileHandle(MODERATOR_PROJECT_MANIFEST_FILE, { create: true });
  const writable = await manifestHandle.createWritable();
  await writable.write(JSON.stringify(buildProjectArchiveManifest(draftMap), null, 2));
  await writable.close();
}

function getRegionByIndex(index) {
  return REGIONS[index] || null;
}

function getDraft(regionId) {
  return state.moderatorDrafts.get(regionId) || null;
}

function getEffectiveRegion(regionOrId) {
  const baseRegion = typeof regionOrId === "string" ? REGIONS[INDEX_BY_ID.get(regionOrId)] : regionOrId;

  if (!baseRegion) {
    return null;
  }

  const baseAtlasPreviewImage = baseRegion.atlasPreviewImage || "";
  const baseAtlasPreviewPage = baseRegion.atlasPreviewPage || 0;
  const baseProjectPdfName = baseRegion.projectPdfName || "";
  const baseProjectPdfPath = baseRegion.projectPdfPath || "";
  const baseProjectPdfSavedAt = baseRegion.projectPdfSavedAt || "";

  const draft = getDraft(baseRegion.id);
  if (!draft) {
    return {
      ...baseRegion,
      map: baseAtlasPreviewImage || baseRegion.map,
      atlasPreviewImage: baseAtlasPreviewImage,
      atlasPreviewPage: baseAtlasPreviewPage,
      projectPdfName: baseProjectPdfName,
      projectPdfPath: baseProjectPdfPath,
      projectPdfSavedAt: baseProjectPdfSavedAt
    };
  }

  const atlasPreviewImage = draft.atlasPreviewImage || baseAtlasPreviewImage;
  const atlasPreviewPage = draft.atlasPreviewPage || baseAtlasPreviewPage;

  return {
    ...baseRegion,
    map: atlasPreviewImage || baseRegion.map,
    caption: draft.caption || baseRegion.caption,
    summary: draft.summary || baseRegion.summary,
    moderatorNote: draft.moderatorNote || baseRegion.moderatorNote || "",
    sourcePdf: draft.sourcePdf || baseRegion.sourcePdf || "",
    sourceFileSize: draft.sourceFileSize || baseRegion.sourceFileSize || "",
    projectPdfName: draft.projectPdfName || baseProjectPdfName,
    projectPdfPath: draft.projectPdfPath || baseProjectPdfPath,
    projectPdfSavedAt: draft.projectPdfSavedAt || baseProjectPdfSavedAt,
    atlasPreviewImage,
    atlasPreviewPage,
    updatedAt: draft.updatedAt || baseRegion.updatedAt || "",
    hasModeratorDraft: true
  };
}

function getAllEffectiveRegions() {
  return REGIONS.map((region) => getEffectiveRegion(region));
}

function getVisibleRegions() {
  const query = state.query.trim().toLowerCase();
  const regions = getAllEffectiveRegions();

  if (!query) {
    return regions;
  }

  return regions.filter((region) => {
    const facts = (region.facts || []).flatMap((fact) => [fact.label, fact.value]);
    const haystack = [
      region.name,
      region.uz,
      region.caption,
      region.summary,
      region.type,
      region.scale,
      region.sourcePdf,
      region.moderatorNote,
      ...(region.themes || []),
      ...facts
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function setTheme(region) {
  const root = document.documentElement;
  const [rust, teal, gold] = region.palette || [];

  root.style.setProperty("--rust", rust || "#b25b32");
  root.style.setProperty("--rust-d", shadeHexColor(rust || "#b25b32", -0.14));
  root.style.setProperty("--teal", teal || "#2e6a64");
  root.style.setProperty("--gold", gold || "#c7a352");
}

function showScene(sceneName) {
  if (sceneName === "moderator" && !MODERATOR_ENABLED) {
    sceneName = state.started ? "album" : "cover";
  }

  if (!REGIONS.length && sceneName !== "cover" && sceneName !== "contents") {
    sceneName = "cover";
  }

  elements.cover.hidden = sceneName !== "cover";
  elements.album.hidden = sceneName !== "album";
  elements.contents.hidden = sceneName !== "contents";
  elements.moderator.hidden = !MODERATOR_ENABLED || sceneName !== "moderator";
  state.currentScene = sceneName;
}

function syncModeratorAvailability() {
  if (elements.btnModerator) {
    elements.btnModerator.hidden = !MODERATOR_ENABLED;
  }

  if (elements.btnOpenModerator) {
    elements.btnOpenModerator.hidden = !MODERATOR_ENABLED;
  }

  if (elements.moderator) {
    elements.moderator.hidden = true;
  }
}

function populateAtlasOptions() {
  if (!elements.atlasSelect) {
    return;
  }

  elements.atlasSelect.innerHTML = ATLAS_COLLECTIONS.map(
    (atlas) => `<option value="${escapeHtml(atlas.id)}">${escapeHtml(atlas.name)}</option>`
  ).join("");
  elements.atlasSelect.value = getActiveAtlasId();
}

function getOverviewMetricText(value, fallback = "--") {
  return Number.isFinite(Number(value)) ? String(Math.round(Number(value))) : fallback;
}

function updateOverview() {
  elements.metricPlates.textContent = String(REGIONS.length);
  elements.metricRivers.textContent = getOverviewMetricText(ATLAS_OVERVIEW.riverCount);
  elements.metricSea.textContent = getOverviewMetricText(ATLAS_OVERVIEW.seaCount);

  if (elements.metricPlatesLabel) {
    elements.metricPlatesLabel.textContent = ATLAS_OVERVIEW.plateLabel || "Plates";
  }

  if (elements.metricRiversLabel) {
    elements.metricRiversLabel.textContent = ATLAS_OVERVIEW.riverLabel || "Great Rivers";
  }

  if (elements.metricSeaLabel) {
    elements.metricSeaLabel.textContent = ATLAS_OVERVIEW.seaLabel || "Vanishing Sea";
  }

  if (elements.atlasCurrentName) {
    elements.atlasCurrentName.textContent = getActiveAtlasName();
  }

  if (elements.contentsSubtitle) {
    elements.contentsSubtitle.textContent = `Search plates in ${getActiveAtlasName()}`;
  }
}

function switchAtlas(atlasId) {
  const nextAtlas = setActiveAtlasData(atlasId);

  if (!nextAtlas) {
    return;
  }

  state.atlasId = nextAtlas.id;
  state.index = 0;
  state.query = "";
  state.projectArchiveRootHandle = null;

  if (elements.contentsSearch) {
    elements.contentsSearch.value = "";
  }

  closeDrawer();
  resetModeratorSessionCache();

  state.moderatorDrafts = mergeDraftMaps(
    buildDraftMap(MODERATOR_DRAFTS, nextAtlas.id),
    USE_BROWSER_DRAFTS ? loadStoredDrafts(nextAtlas.id) : new Map()
  );
  state.moderatorRegionId = REGIONS[0]?.id ?? "";

  populateAtlasOptions();
  updateOverview();
  populateModeratorRegionOptions();
  buildFilmstrip();
  buildContents();
  buildModeratorDraftList();

  if (!REGIONS.length) {
    state.started = false;
    showScene("cover");
    return;
  }

  setTheme(getEffectiveRegion(REGIONS[0]) || REGIONS[0]);

  if (state.currentScene === "moderator") {
    populateModeratorForm(state.moderatorRegionId);
    return;
  }

  if (state.started || state.currentScene === "album") {
    state.started = true;
    render(0);
    return;
  }

  syncNavigation();
  syncFilmstrip();
}

function syncFullscreenLabel() {
  elements.fullLabel.textContent = document.fullscreenElement ? "Exit full" : "Fullscreen";
}

function setModeratorStatus(message, isAlert = false) {
  elements.moderatorStatus.textContent = message;
  elements.moderatorStatus.classList.toggle("is-alert", Boolean(isAlert));
}

function resetView() {
  view.scale = 1;
  view.fit = 1;
  view.x = 0;
  view.y = 0;
  elements.mapImage.style.transform = "translate(0px, 0px) scale(1)";
}

function clampView() {
  const viewportWidth = elements.viewport.clientWidth;
  const viewportHeight = elements.viewport.clientHeight;
  const imageWidth = elements.mapImage.naturalWidth * view.scale;
  const imageHeight = elements.mapImage.naturalHeight * view.scale;

  if (imageWidth <= viewportWidth) {
    view.x = (viewportWidth - imageWidth) / 2;
  } else {
    view.x = Math.min(0, Math.max(viewportWidth - imageWidth, view.x));
  }

  if (imageHeight <= viewportHeight) {
    view.y = (viewportHeight - imageHeight) / 2;
  } else {
    view.y = Math.min(0, Math.max(viewportHeight - imageHeight, view.y));
  }
}

function applyView() {
  if (!state.mapReady) {
    return;
  }

  clampView();
  elements.mapImage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

function fitImage() {
  if (!state.mapReady || state.currentScene !== "album") {
    return;
  }

  const viewportWidth = elements.viewport.clientWidth;
  const viewportHeight = elements.viewport.clientHeight;
  const imageWidth = elements.mapImage.naturalWidth;
  const imageHeight = elements.mapImage.naturalHeight;

  if (!viewportWidth || !viewportHeight || !imageWidth || !imageHeight) {
    return;
  }

  view.fit = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
  view.scale = view.fit;
  view.x = (viewportWidth - imageWidth * view.scale) / 2;
  view.y = (viewportHeight - imageHeight * view.scale) / 2;
  applyView();
}

function showHint() {
  if (state.hintDismissed || !state.mapReady) {
    elements.hint.classList.add("gone");
    return;
  }

  elements.hint.classList.remove("gone");
}

function hideHint() {
  state.hintDismissed = true;
  elements.hint.classList.add("gone");
}

function zoomAt(centerX, centerY, factor) {
  if (!state.mapReady) {
    return;
  }

  const minScale = view.fit;
  const maxScale = view.fit * 5;
  const nextScale = Math.min(maxScale, Math.max(minScale, view.scale * factor));
  const ratio = nextScale / view.scale;

  view.x = centerX - (centerX - view.x) * ratio;
  view.y = centerY - (centerY - view.y) * ratio;
  view.scale = nextScale;
  applyView();
  hideHint();
}

function openDrawer() {
  elements.drawer.classList.add("on");
  elements.scrim.classList.add("on");
}

function closeDrawer() {
  elements.drawer.classList.remove("on");
  elements.scrim.classList.remove("on");
}

function fillDrawer(region) {
  const draftFacts = [];

  if (region.atlasPreviewImage) {
    draftFacts.push({
      key: "focus",
      label: "Atlas preview",
      value: region.atlasPreviewPage
        ? `Integrated PDF page ${region.atlasPreviewPage}`
        : "Integrated moderator PDF preview"
    });
  }

  if (region.sourcePdf) {
    draftFacts.push({
      key: "focus",
      label: "Source PDF",
      value: region.sourceFileSize ? `${region.sourcePdf} · ${region.sourceFileSize}` : region.sourcePdf
    });
  }

  if (region.projectPdfPath) {
    draftFacts.push({
      key: "focus",
      label: "Project archive",
      value: region.projectPdfPath
    });
  }

  if (region.moderatorNote) {
    draftFacts.push({
      key: "focus",
      label: "Associate note",
      value: region.moderatorNote
    });
  }

  elements.drEk.textContent = region.type;
  elements.drName.textContent = region.name;
  elements.drUz.textContent = region.uz;
  elements.drSummary.textContent = region.summary;
  elements.drFacts.innerHTML = [...(region.facts || []), ...draftFacts]
    .map((fact) => {
      const icon = ICONS[fact.key] || ICONS.focus;
      const isWater = fact.key === "water" ? " water" : "";

      return `
        <div class="fact${isWater}">
          <div class="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${icon}</svg>
          </div>
          <div class="ft">
            <div class="fl">${escapeHtml(fact.label)}</div>
            <div class="fv">${escapeHtml(fact.value)}</div>
          </div>
        </div>
      `;
    })
    .join("");

  elements.drGloss.innerHTML = ATLAS_GLOSSARY.map(
    (entry) => `<span>${escapeHtml(entry.term)}</span><span>${escapeHtml(entry.definition)}</span>`
  ).join("");
}

function renderMap(region) {
  state.pendingMapId = region.id;
  state.mapReady = false;
  resetView();
  showHint();

  const draftPdfMessage = region.sourcePdf
    ? ` Current moderator draft source PDF: ${region.sourcePdf}.`
    : "";

  elements.scaleTag.textContent = region.scale || "Curated plate";
  elements.placeholderTitle.textContent = region.sourcePdf
    ? `Awaiting export from ${region.sourcePdf}`
    : `${region.name} plate not found`;
  elements.placeholderCopy.textContent = `${region.caption} Export a JPG to ${region.map} to enable panning and zooming in the offline atlas.${draftPdfMessage}`;
  elements.mapImage.hidden = true;
  elements.mapPlaceholder.hidden = false;
  elements.mapImage.removeAttribute("src");
  elements.mapImage.alt = "";

  if (!region.map) {
    elements.hint.classList.add("gone");
    return;
  }

  const requestId = region.id;
  const preview = new Image();

  preview.onload = () => {
    if (state.pendingMapId !== requestId) {
      return;
    }

    state.mapReady = true;
    elements.mapImage.classList.remove("swap");
    elements.mapImage.src = region.map;
    elements.mapImage.alt = `${region.name} ${String(region.type || "atlas plate").toLowerCase()}`;
    elements.mapImage.hidden = false;
    elements.mapPlaceholder.hidden = true;

    elements.mapImage.onload = () => {
      if (state.pendingMapId === requestId) {
        fitImage();
        showHint();
      }
    };

    if (elements.mapImage.complete && elements.mapImage.naturalWidth) {
      fitImage();
      showHint();
    }

    void elements.mapImage.offsetWidth;
    elements.mapImage.classList.add("swap");
  };

  preview.onerror = () => {
    if (state.pendingMapId !== requestId) {
      return;
    }

    state.mapReady = false;
    elements.mapImage.hidden = true;
    elements.mapPlaceholder.hidden = false;
    elements.hint.classList.add("gone");
  };

  preview.src = region.map;
}

function syncNavigation() {
  elements.prev.disabled = state.index === 0;
  elements.next.disabled = state.index === REGIONS.length - 1;
  elements.cIdx.textContent = String(state.index + 1).padStart(2, "0");
  if (elements.cTotal) {
    elements.cTotal.textContent = String(REGIONS.length).padStart(2, "0");
  }
  elements.cName.textContent = getEffectiveRegion(REGIONS[state.index])?.name || "Atlas plate";
}

function syncFilmstrip() {
  Array.from(elements.filmstrip.children).forEach((button, buttonIndex) => {
    button.classList.toggle("cur", buttonIndex === state.index);
  });
}

function syncContentsHighlight() {
  Array.from(elements.contentsGrid.children).forEach((card) => {
    const cardIndex = Number(card.dataset.index);
    card.classList.toggle("curcard", state.started && cardIndex === state.index);
  });
}

function render(index) {
  const region = getEffectiveRegion(getRegionByIndex(index));

  if (!region) {
    return;
  }

  state.index = index;
  setTheme(region);
  elements.pNum.textContent = `PL · ${String(index + 1).padStart(2, "0")}`;
  elements.pName.textContent = region.name;
  elements.pUz.textContent = region.uz;
  elements.pTypeA.textContent = region.type;
  elements.pTypeB.textContent = region.scale;
  fillDrawer(region);
  renderMap(region);
  syncNavigation();
  syncFilmstrip();
  syncContentsHighlight();
}

function animateToIndex(targetIndex) {
  if (targetIndex < 0 || targetIndex >= REGIONS.length || state.animating) {
    return;
  }

  if (targetIndex === state.index) {
    return;
  }

  const direction = targetIndex > state.index ? 1 : -1;
  state.animating = true;
  closeDrawer();

  elements.plate.classList.add(direction > 0 ? "out-fwd" : "out-bwd");
  elements.plate.addEventListener(
    "animationend",
    function handleExit() {
      elements.plate.classList.remove("out-fwd", "out-bwd");
      render(targetIndex);
      elements.plate.classList.add(direction > 0 ? "in-fwd" : "in-bwd");
      elements.plate.addEventListener(
        "animationend",
        function handleEnter() {
          elements.plate.classList.remove("in-fwd", "in-bwd");
          state.animating = false;
        },
        { once: true }
      );
    },
    { once: true }
  );
}

function go(direction) {
  if (state.currentScene !== "album") {
    return;
  }

  animateToIndex(state.index + direction);
}

function jumpToIndex(targetIndex) {
  if (targetIndex < 0 || targetIndex >= REGIONS.length) {
    return;
  }

  if (state.currentScene !== "album") {
    state.started = true;
    showScene("album");
    render(targetIndex);
    closeDrawer();
    return;
  }

  animateToIndex(targetIndex);
}

function buildFilmstrip() {
  elements.filmstrip.innerHTML = REGIONS.map(
    (region, index) =>
      `<button type="button" data-index="${index}" title="${escapeHtml(region.name)}"></button>`
  ).join("");

  Array.from(elements.filmstrip.children).forEach((button) => {
    button.addEventListener("click", () => {
      jumpToIndex(Number(button.dataset.index));
    });
  });
}

function getContentsCountLabel(count) {
  return `${count} plate${count === 1 ? "" : "s"} visible`;
}

function buildContents() {
  const visibleRegions = getVisibleRegions();
  elements.contentsCount.textContent = getContentsCountLabel(visibleRegions.length);

  if (!visibleRegions.length) {
    elements.contentsGrid.innerHTML = `
      <div class="empty-contents">
        No atlas plates match this filter. Clear the search or add broader keywords
        in js/regions.js so this atlas can surface them.
      </div>
    `;
    return;
  }

  elements.contentsGrid.innerHTML = visibleRegions
    .map((region, visibleIndex) => {
      const regionIndex = INDEX_BY_ID.get(region.id);
      const currentClass = state.started && regionIndex === state.index ? " curcard" : "";
      const draftTag = region.hasModeratorDraft
        ? '<div class="card-draft-tag">Moderator draft</div>'
        : "";

      return `
        <button
          class="ccard${currentClass}"
          type="button"
          data-index="${regionIndex}"
          data-region-id="${escapeHtml(region.id)}"
          style="animation-delay:${visibleIndex * 40}ms"
        >
          <div class="cthumb">
            <span class="cnum">PL ${String(regionIndex + 1).padStart(2, "0")}</span>
            <img src="${escapeHtml(region.map)}" alt="${escapeHtml(region.name)} preview" loading="lazy" />
            <div class="cthumb-fallback">
              <span>Awaiting map export</span>
              <strong>${escapeHtml(region.name)}</strong>
            </div>
          </div>
          <div class="cmeta">
            <h4>${escapeHtml(region.name)}</h4>
            <div class="ct">${escapeHtml(region.scale)}</div>
            ${draftTag}
          </div>
        </button>
      `;
    })
    .join("");

  Array.from(elements.contentsGrid.children).forEach((card) => {
    if (!(card instanceof HTMLButtonElement)) {
      return;
    }

    card.addEventListener("click", () => {
      jumpToIndex(Number(card.dataset.index));
    });

    const thumb = card.querySelector(".cthumb");
    const image = card.querySelector("img");

    if (!thumb || !image) {
      return;
    }

    image.addEventListener("load", () => {
      thumb.classList.add("has-image");
    });

    image.addEventListener("error", () => {
      thumb.classList.remove("has-image");
    });

    if (image.complete && image.naturalWidth) {
      thumb.classList.add("has-image");
    }
  });
}

function getDefaultDraftValues(regionId) {
  const region = getEffectiveRegion(regionId);
  return {
    regionId,
    caption: region?.caption || "",
    summary: region?.summary || "",
    moderatorNote: getDraft(regionId)?.moderatorNote || "",
    sourcePdf: getDraft(regionId)?.sourcePdf || "",
    sourceFileSize: getDraft(regionId)?.sourceFileSize || "",
    projectPdfName: getDraft(regionId)?.projectPdfName || region?.projectPdfName || "",
    projectPdfPath: getDraft(regionId)?.projectPdfPath || region?.projectPdfPath || ""
  };
}

function formatBytes(byteCount) {
  if (!Number.isFinite(byteCount) || byteCount <= 0) {
    return "";
  }

  if (byteCount < 1024) {
    return `${byteCount} B`;
  }

  if (byteCount < 1024 * 1024) {
    return `${(byteCount / 1024).toFixed(1)} KB`;
  }

  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}

function revokeModeratorPdf(regionId) {
  const existingUrl = state.moderatorPdfUrls.get(regionId);
  const existingDocument = state.moderatorPdfDocuments.get(regionId);

  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
    state.moderatorPdfUrls.delete(regionId);
  }

  if (existingDocument?.loadingTask?.destroy) {
    existingDocument.loadingTask.destroy();
  }

  state.moderatorPdfDocuments.delete(regionId);

  state.moderatorSessionFiles.delete(regionId);
  state.moderatorPdfBytes.delete(regionId);
  state.moderatorPdfPageByRegion.delete(regionId);

  if (elements.moderatorRegion.value === regionId) {
    resetModeratorPdfCanvas();
  }
}

function resetModeratorSessionCache() {
  Array.from(state.moderatorPdfUrls.keys()).forEach((regionId) => {
    revokeModeratorPdf(regionId);
  });

  state.moderatorPdfUrls.clear();
  state.moderatorSessionFiles.clear();
  state.moderatorPdfBytes.clear();
  state.moderatorPdfDocuments.clear();
  state.moderatorPdfPageByRegion.clear();
  resetModeratorPdfCanvas();
}

function resetModeratorPdfCanvas() {
  state.moderatorPdfRenderToken += 1;

  if (elements.moderatorPdfCanvas) {
    const context = elements.moderatorPdfCanvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, elements.moderatorPdfCanvas.width, elements.moderatorPdfCanvas.height);
    }
    elements.moderatorPdfCanvas.width = 0;
    elements.moderatorPdfCanvas.height = 0;
    elements.moderatorPdfCanvas.style.width = "0";
    elements.moderatorPdfCanvas.style.height = "0";
  }

  elements.moderatorPdfRender.hidden = true;
  elements.moderatorPdfPage.textContent = "Preview unavailable";
  elements.moderatorPdfPrev.disabled = true;
  elements.moderatorPdfNext.disabled = true;
}

async function ensureModeratorPdfDocument(regionId) {
  const existingEntry = state.moderatorPdfDocuments.get(regionId);
  if (existingEntry) {
    return existingEntry;
  }

  const pdfBytes = state.moderatorPdfBytes.get(regionId);
  if (!pdfBytes || !PDFJS_LIB?.getDocument) {
    return null;
  }

  const loadingTask = PDFJS_LIB.getDocument({ data: pdfBytes.slice() });
  const documentEntry = {
    loadingTask,
    promise: loadingTask.promise
  };

  state.moderatorPdfDocuments.set(regionId, documentEntry);
  return documentEntry;
}

async function renderModeratorPdfPage(regionId, requestedPage = 1) {
  const sessionFile = state.moderatorSessionFiles.get(regionId);
  const pdfBytes = state.moderatorPdfBytes.get(regionId);

  if (!sessionFile) {
    resetModeratorPdfCanvas();
    return;
  }

  if (!pdfBytes) {
    resetModeratorPdfCanvas();
    const hint = getModeratorPreviewEnvironmentHint();
    elements.moderatorPdfCopy.textContent = hint
      ? `This browser kept ${sessionFile.name} available for open or download, but it did not expose the file bytes for inline preview. ${hint}`
      : `This browser kept ${sessionFile.name} available for open or download, but it did not expose the file bytes for inline preview.`;
    return;
  }

  if (!PDFJS_LIB?.getDocument) {
    resetModeratorPdfCanvas();
    elements.moderatorPdfCopy.textContent = "Inline preview is unavailable until `npm install` has been run locally. Use Open PDF or Download PDF instead.";
    return;
  }

  const renderToken = ++state.moderatorPdfRenderToken;
  elements.moderatorPdfRender.hidden = false;
  elements.moderatorPdfPage.textContent = "Rendering preview...";
  elements.moderatorPdfPrev.disabled = true;
  elements.moderatorPdfNext.disabled = true;

  try {
    const documentEntry = await ensureModeratorPdfDocument(regionId);
    if (!documentEntry) {
      resetModeratorPdfCanvas();
      return;
    }

    const pdfDocument = await documentEntry.promise;
    if (renderToken !== state.moderatorPdfRenderToken || elements.moderatorRegion.value !== regionId) {
      return;
    }

    const pageNumber = Math.max(1, Math.min(requestedPage, pdfDocument.numPages));
    const page = await pdfDocument.getPage(pageNumber);
    if (renderToken !== state.moderatorPdfRenderToken || elements.moderatorRegion.value !== regionId) {
      return;
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const stageWidth = Math.max(320, elements.moderatorPdfStage.clientWidth - 48);
    const scale = Math.min(MODERATOR_PDF_PREVIEW_MAX_SCALE, stageWidth / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    const canvas = elements.moderatorPdfCanvas;
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
    }).promise;

    if (renderToken !== state.moderatorPdfRenderToken || elements.moderatorRegion.value !== regionId) {
      return;
    }

    state.moderatorPdfPageByRegion.set(regionId, pageNumber);
    elements.moderatorPdfPage.textContent = `Page ${pageNumber} of ${pdfDocument.numPages}`;
    elements.moderatorPdfPrev.disabled = pageNumber <= 1;
    elements.moderatorPdfNext.disabled = pageNumber >= pdfDocument.numPages;
    elements.moderatorPdfCopy.textContent = `Previewing ${sessionFile.name} (${formatBytes(sessionFile.size)}). Use the buttons below to open the original PDF in this browser or download a local copy.`;
  } catch {
    if (renderToken !== state.moderatorPdfRenderToken) {
      return;
    }

    resetModeratorPdfCanvas();
    const hint = getModeratorPreviewEnvironmentHint();
    elements.moderatorPdfCopy.textContent = hint
      ? `This browser could not render ${sessionFile.name} inline. Use Open PDF or Download PDF instead. ${hint}`
      : `This browser could not render ${sessionFile.name} inline. Use Open PDF or Download PDF instead.`;
    setModeratorStatus(
      hint
        ? `Could not render ${sessionFile.name} inline. Use Open PDF or Download PDF instead. ${hint}`
        : `Could not render ${sessionFile.name} inline. Use Open PDF or Download PDF instead.`,
      true
    );
  }
}

async function renderModeratorAtlasPdfImage(regionId, requestedPage = 1) {
  const documentEntry = await ensureModeratorPdfDocument(regionId);
  if (!documentEntry) {
    return "";
  }

  const pdfDocument = await documentEntry.promise;
  const pageNumber = Math.max(1, Math.min(requestedPage, pdfDocument.numPages));
  const page = await pdfDocument.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.max(
    0.5,
    Math.min(
      MODERATOR_ATLAS_RENDER_MAX_SCALE,
      MODERATOR_ATLAS_RENDER_MAX_WIDTH / baseViewport.width,
      MODERATOR_ATLAS_RENDER_MAX_HEIGHT / baseViewport.height
    )
  );
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    return "";
  }

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  return canvas.toDataURL("image/jpeg", 0.96);
}

function updateModeratorPdfPreview(regionId) {
  const pdfUrl = state.moderatorPdfUrls.get(regionId);
  const draft = getDraft(regionId);
  const sessionFile = state.moderatorSessionFiles.get(regionId);

  if (pdfUrl) {
    const pdfName = sessionFile?.name || draft?.sourcePdf || "attached-region.pdf";
    const sizeText = sessionFile ? ` (${formatBytes(sessionFile.size)})` : "";

    elements.moderatorPdfEmpty.hidden = true;
    elements.moderatorPdfRender.hidden = false;
    elements.moderatorPdfAccess.hidden = false;
    elements.moderatorPdfName.textContent = pdfName;
    elements.moderatorPdfCopy.textContent = `Rendering a preview for ${pdfName}${sizeText}...`;
    elements.moderatorPdfOpen.href = pdfUrl;
    elements.moderatorPdfDownload.href = pdfUrl;
    elements.moderatorPdfDownload.download = pdfName;
    elements.moderatorPdfStage.classList.add("has-pdf");
    renderModeratorPdfPage(regionId, state.moderatorPdfPageByRegion.get(regionId) || 1);
    return;
  }

  resetModeratorPdfCanvas();
  elements.moderatorPdfEmpty.hidden = false;
  elements.moderatorPdfAccess.hidden = true;
  elements.moderatorPdfOpen.removeAttribute("href");
  elements.moderatorPdfDownload.removeAttribute("href");
  elements.moderatorPdfStage.classList.remove("has-pdf");

  if (draft?.sourcePdf) {
    elements.moderatorPdfEmpty.textContent = `Draft PDF recorded: ${draft.sourcePdf}. Re-attach the file in this browser session to preview, open, or download it here.`;
    return;
  }

  elements.moderatorPdfEmpty.textContent = "Upload a regional PDF to preview it here. The atlas can record the file name and description now, then your associate can convert the PDF pages to JPG plates with the existing Python tool.";
}

function updateModeratorCommand(regionId) {
  const draft = getDraft(regionId);
  const sessionFile = state.moderatorSessionFiles.get(regionId);
  const pdfName = sessionFile?.name || draft?.sourcePdf || "your-region-map.pdf";
  const baseRegion = REGIONS[INDEX_BY_ID.get(regionId)];
  const suggestedTarget = baseRegion?.map || "assets/maps/your-region.jpg";
  const archivedPdfPath = draft?.projectPdfPath || `${MODERATOR_PROJECT_ARCHIVE_PATH}/${buildProjectPdfFileName(draft?.projectPdfName || pdfName, regionId)}`;

  elements.moderatorCommand.textContent = [
    `# Optional project archive: ${archivedPdfPath}`,
    `python tools/apply_moderator_handoff.py moderator-handoff.json`,
    `python tools/extract_maps.py "${draft?.projectPdfPath || `pdfs/${pdfName}`}" --output-dir assets/maps`,
    `# Rename the exported JPG you want to ${suggestedTarget}`,
    `python tools/build.py`
  ].join("\n");
}

function populateModeratorRegionOptions() {
  elements.moderatorRegion.innerHTML = REGIONS.map(
    (region, index) =>
      `<option value="${escapeHtml(region.id)}">PL ${String(index + 1).padStart(2, "0")} · ${escapeHtml(region.name)}</option>`
  ).join("");
}

function populateModeratorForm(regionId) {
  const defaults = getDefaultDraftValues(regionId);

  state.moderatorRegionId = regionId;
  elements.moderatorRegion.value = regionId;
  elements.moderatorCaption.value = defaults.caption;
  elements.moderatorSummary.value = defaults.summary;
  elements.moderatorNote.value = defaults.moderatorNote;
  elements.moderatorProjectPdfName.value = defaults.projectPdfName;
  elements.moderatorPdf.value = "";

  if (defaults.sourcePdf) {
    const sizeText = defaults.sourceFileSize ? ` · ${defaults.sourceFileSize}` : "";
    const archiveText = defaults.projectPdfPath ? ` · Archived in ${defaults.projectPdfPath}` : "";
    elements.moderatorFileMeta.textContent = `Recorded source PDF: ${defaults.sourcePdf}${sizeText}${archiveText}`;
  } else {
    elements.moderatorFileMeta.textContent = "No PDF selected yet. Attach one to preview it during this session and to record its filename in the handoff package.";
  }

  updateModeratorPdfPreview(regionId);
  updateModeratorCommand(regionId);
}

function buildModeratorDraftList() {
  const drafts = serializeDraftMap(state.moderatorDrafts);

  if (!drafts.length) {
    elements.moderatorDraftList.innerHTML = `
      <div class="draft-empty">
        No moderator drafts saved yet. Pick a plate, add a PDF reference and a description,
        then save the draft to create a handoff package.
      </div>
    `;
    return;
  }

  elements.moderatorDraftList.innerHTML = drafts
    .map((draft) => {
      const region = REGIONS[INDEX_BY_ID.get(draft.regionId)];
      const detailParts = [];

      if (draft.sourcePdf) {
        detailParts.push(`Source PDF: ${draft.sourcePdf}${draft.sourceFileSize ? ` · ${draft.sourceFileSize}` : ""}`);
      }

      if (draft.projectPdfPath) {
        detailParts.push(`Project copy: ${draft.projectPdfPath}`);
      }

      if (draft.atlasPreviewImage) {
        detailParts.push(`Atlas preview saved${draft.atlasPreviewPage ? ` · Page ${draft.atlasPreviewPage}` : ""}`);
      }

      const detail = detailParts.join(" · ") || "Description-only draft";
      const updated = draft.updatedAt ? `Updated ${draft.updatedAt}` : "Draft saved";

      return `
        <div class="draft-row" data-region-id="${escapeHtml(draft.regionId)}">
          <div>
            <div class="draft-row-title">${escapeHtml(region?.name || draft.regionId)}</div>
            <div class="draft-chip">${escapeHtml(updated)}</div>
            <div class="draft-row-detail">${escapeHtml(detail)}</div>
          </div>
          <div class="draft-row-actions">
            <button class="draft-action" type="button" data-action="load" data-region-id="${escapeHtml(draft.regionId)}">Load</button>
            <button class="draft-action" type="button" data-action="preview" data-region-id="${escapeHtml(draft.regionId)}">Preview</button>
            <button class="draft-action" type="button" data-action="delete" data-region-id="${escapeHtml(draft.regionId)}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function syncModeratorViews() {
  buildModeratorDraftList();
  buildContents();

  if (state.started) {
    render(state.index);
  }

  updateModeratorCommand(state.moderatorRegionId);
}

function createDraftFromForm() {
  const regionId = elements.moderatorRegion.value;
  const baseRegion = REGIONS[INDEX_BY_ID.get(regionId)];
  const sessionFile = state.moderatorSessionFiles.get(regionId);
  const existingDraft = getDraft(regionId);
  const requestedProjectPdfName = elements.moderatorProjectPdfName.value.trim() || existingDraft?.projectPdfName || "";
  const normalizedProjectPdfName = requestedProjectPdfName
    ? buildProjectPdfFileName(requestedProjectPdfName, regionId)
    : "";
  const archivedProjectName = existingDraft?.projectPdfName || "";
  const keepArchivedProjectPath = !normalizedProjectPdfName || !archivedProjectName || normalizedProjectPdfName === archivedProjectName;

  const draft = {
    atlasId: getActiveAtlasId(),
    regionId,
    caption: elements.moderatorCaption.value.trim(),
    summary: elements.moderatorSummary.value.trim(),
    moderatorNote: elements.moderatorNote.value.trim(),
    sourcePdf: sessionFile?.name || existingDraft?.sourcePdf || "",
    sourceFileSize: sessionFile ? formatBytes(sessionFile.size) : existingDraft?.sourceFileSize || "",
    projectPdfName: requestedProjectPdfName,
    projectPdfPath: keepArchivedProjectPath ? existingDraft?.projectPdfPath || "" : "",
    projectPdfSavedAt: keepArchivedProjectPath ? existingDraft?.projectPdfSavedAt || "" : "",
    atlasPreviewImage: existingDraft?.atlasPreviewImage || "",
    atlasPreviewPage: existingDraft?.atlasPreviewPage || 0,
    updatedAt: new Date().toLocaleString()
  };

  const isMeaningful =
    draft.caption !== (baseRegion?.caption || "") ||
    draft.summary !== (baseRegion?.summary || "") ||
    Boolean(draft.moderatorNote) ||
    Boolean(draft.sourcePdf) ||
    Boolean(draft.projectPdfName) ||
    Boolean(draft.atlasPreviewImage);

  return isMeaningful ? draft : null;
}

function saveModeratorDraft() {
  const draft = createDraftFromForm();
  const regionId = elements.moderatorRegion.value;

  if (!draft) {
    state.moderatorDrafts.delete(regionId);
    persistDrafts();
    syncModeratorViews();
    setModeratorStatus("No custom draft content remained for this region, so the saved draft was cleared.");
    return;
  }

  state.moderatorDrafts.set(regionId, draft);
  persistDrafts();
  syncModeratorViews();
  populateModeratorForm(regionId);
  setModeratorStatus(`Draft saved for ${getEffectiveRegion(regionId)?.name}.`);
}

async function archiveModeratorPdfToProject() {
  const regionId = elements.moderatorRegion.value;
  const currentRegion = getEffectiveRegion(regionId);
  const existingDraft = getDraft(regionId);
  const sessionFile = state.moderatorSessionFiles.get(regionId);

  if (!sessionFile) {
    setModeratorStatus("Attach a PDF for this region first, then archive it into the project folder.", true);
    return;
  }

  if (typeof window.showDirectoryPicker !== "function") {
    setModeratorStatus(
      "Project archiving needs a Chromium browser over local HTTP so the atlas can ask for write access to the project folder.",
      true
    );
    return;
  }

  const fileName = buildProjectPdfFileName(
    elements.moderatorProjectPdfName.value || existingDraft?.projectPdfName || sessionFile.name,
    regionId
  );
  const timestamp = new Date().toLocaleString();
  const nextDraft = {
    ...(createDraftFromForm() || {
      atlasId: getActiveAtlasId(),
      regionId,
      caption: elements.moderatorCaption.value.trim() || existingDraft?.caption || currentRegion?.caption || "",
      summary: elements.moderatorSummary.value.trim() || existingDraft?.summary || currentRegion?.summary || "",
      moderatorNote: elements.moderatorNote.value.trim() || existingDraft?.moderatorNote || "",
      sourcePdf: sessionFile.name,
      sourceFileSize: formatBytes(sessionFile.size),
      atlasPreviewImage: existingDraft?.atlasPreviewImage || "",
      atlasPreviewPage: existingDraft?.atlasPreviewPage || 0,
      updatedAt: timestamp
    }),
    sourcePdf: sessionFile.name,
    sourceFileSize: formatBytes(sessionFile.size),
    projectPdfName: fileName,
    projectPdfPath: `${MODERATOR_PROJECT_ARCHIVE_PATH}/${fileName}`,
    projectPdfSavedAt: timestamp,
    updatedAt: timestamp
  };
  const nextDraftMap = new Map(state.moderatorDrafts);
  nextDraftMap.set(regionId, nextDraft);

  try {
    setModeratorStatus("Choose the atlas project folder to store this PDF and update the project memory manifest.");
    const archiveHandle = await getProjectArchiveDirectoryHandle();

    if (!archiveHandle) {
      setModeratorStatus("Project archiving is unavailable in this browser session.", true);
      return;
    }

    const pdfHandle = await archiveHandle.getFileHandle(fileName, { create: true });
    const writable = await pdfHandle.createWritable();
    await writable.write(sessionFile);
    await writable.close();
    await writeProjectArchiveManifest(archiveHandle, nextDraftMap);
  } catch (error) {
    if (error?.name === "AbortError") {
      setModeratorStatus("Project archive save was cancelled before the atlas project folder was updated.", true);
      return;
    }

    state.projectArchiveRootHandle = null;
    setModeratorStatus(
      `Could not archive ${sessionFile.name} into ${MODERATOR_PROJECT_ARCHIVE_PATH}. Recheck folder permissions and try again.`,
      true
    );
    return;
  }

  state.moderatorDrafts = nextDraftMap;
  persistDrafts();
  syncModeratorViews();
  populateModeratorForm(regionId);
  setModeratorStatus(
    `Saved ${fileName} into ${MODERATOR_PROJECT_ARCHIVE_PATH} and updated ${MODERATOR_PROJECT_MANIFEST_FILE} for ${currentRegion?.name || regionId}.`
  );
}

async function integrateModeratorPdfIntoAtlas() {
  const regionId = elements.moderatorRegion.value;
  const currentRegion = getEffectiveRegion(regionId);
  const existingDraft = getDraft(regionId);
  const sessionFile = state.moderatorSessionFiles.get(regionId);
  const canvas = elements.moderatorPdfCanvas;
  const pageNumber = state.moderatorPdfPageByRegion.get(regionId) || existingDraft?.atlasPreviewPage || 1;

  if (elements.moderatorPdfRender.hidden || !canvas.width || !canvas.height) {
    setModeratorStatus("Render a PDF page in the moderator preview first, then integrate it into the atlas.", true);
    return;
  }

  let atlasPreviewImage = "";
  let usedPreviewFallback = false;

  try {
    setModeratorStatus(`Rendering page ${pageNumber} at atlas quality...`);
    atlasPreviewImage = await renderModeratorAtlasPdfImage(regionId, pageNumber);
  } catch {
    atlasPreviewImage = "";
  }

  if (!atlasPreviewImage) {
    try {
      atlasPreviewImage = canvas.toDataURL("image/jpeg", 0.92);
      usedPreviewFallback = true;
    } catch {
      setModeratorStatus("Could not capture the current PDF page for atlas integration. Re-render the PDF preview and try again.", true);
      return;
    }
  }

  const fallbackDraft = {
    atlasId: getActiveAtlasId(),
    regionId,
    caption: elements.moderatorCaption.value.trim() || existingDraft?.caption || currentRegion?.caption || "",
    summary: elements.moderatorSummary.value.trim() || existingDraft?.summary || currentRegion?.summary || "",
    moderatorNote: elements.moderatorNote.value.trim() || existingDraft?.moderatorNote || "",
    sourcePdf: sessionFile?.name || existingDraft?.sourcePdf || currentRegion?.sourcePdf || "",
    sourceFileSize: sessionFile
      ? formatBytes(sessionFile.size)
      : existingDraft?.sourceFileSize || currentRegion?.sourceFileSize || "",
    atlasPreviewImage: existingDraft?.atlasPreviewImage || "",
    atlasPreviewPage: existingDraft?.atlasPreviewPage || 0,
    updatedAt: new Date().toLocaleString()
  };
  const nextDraft = {
    ...(createDraftFromForm() || fallbackDraft),
    atlasPreviewImage,
    atlasPreviewPage: pageNumber,
    updatedAt: new Date().toLocaleString()
  };

  state.moderatorDrafts.set(regionId, nextDraft);

  try {
    persistDrafts();
  } catch {
    if (existingDraft) {
      state.moderatorDrafts.set(regionId, existingDraft);
    } else {
      state.moderatorDrafts.delete(regionId);
    }

    syncModeratorViews();
    populateModeratorForm(regionId);
    setModeratorStatus("Could not save the integrated atlas preview in browser storage. The preview image may be too large for this browser profile.", true);
    return;
  }

  syncModeratorViews();
  populateModeratorForm(regionId);
  setModeratorStatus(
    usedPreviewFallback
      ? `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId} using the visible preview size. Use Preview in atlas to inspect it.`
      : `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId} with a higher-resolution PDF render. Use Preview in atlas to inspect it.`
  );
}

function deleteModeratorDraft(regionId) {
  state.moderatorDrafts.delete(regionId);
  persistDrafts();
  revokeModeratorPdf(regionId);
  syncModeratorViews();

  if (state.moderatorRegionId === regionId) {
    populateModeratorForm(regionId);
  }

  setModeratorStatus(`Removed the saved draft for ${REGIONS[INDEX_BY_ID.get(regionId)]?.name || regionId}.`);
}

function exportModeratorHandoff() {
  const drafts = serializeDraftMap(state.moderatorDrafts);

  if (!drafts.length) {
    setModeratorStatus("Create at least one saved draft before exporting a handoff package.", true);
    return;
  }

  const payload = {
    version: 1,
    atlasId: getActiveAtlasId(),
    atlasName: getActiveAtlasName(),
    exportedAt: new Date().toISOString(),
    instructions: [
      "Give this JSON together with the original source PDFs to the associate finishing the atlas.",
      "Run python tools/apply_moderator_handoff.py moderator-handoff.json to integrate the draft text into the project.",
      "Run python tools/extract_maps.py on the PDFs, rename the desired JPGs to match the atlas map paths, then rebuild with python tools/build.py."
    ],
    drafts
  };

  const fileName = `atlas-moderator-handoff-${getActiveAtlasId()}-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  setModeratorStatus(`Exported ${drafts.length} moderator draft${drafts.length === 1 ? "" : "s"} to ${fileName}.`);
}

async function importModeratorHandoff(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const drafts = Array.isArray(parsed) ? parsed : parsed.drafts;
    const importedMap = buildDraftMap(Array.isArray(drafts) ? drafts : [], getActiveAtlasId());

    if (!importedMap.size) {
      const sourceAtlasId = normalizeAtlasId(
        (!Array.isArray(parsed) && parsed?.atlasId) || (Array.isArray(drafts) ? drafts[0]?.atlasId : "") || getActiveAtlasId(),
        getActiveAtlasId()
      );
      const sourceAtlasName = !Array.isArray(parsed) ? String(parsed?.atlasName || "").trim() : "";

      if (sourceAtlasId && sourceAtlasId !== getActiveAtlasId()) {
        setModeratorStatus(
          `The selected handoff was exported for ${sourceAtlasName || sourceAtlasId}. Switch the atlas selector first, then import it again.`,
          true
        );
        return;
      }

      setModeratorStatus("The selected handoff file did not contain any valid drafts for the current atlas.", true);
      return;
    }

    state.moderatorDrafts = mergeDraftMaps(state.moderatorDrafts, importedMap);
    persistDrafts();
    syncModeratorViews();
    populateModeratorForm(state.moderatorRegionId || REGIONS[0]?.id || "");
    setModeratorStatus(`Imported ${importedMap.size} moderator draft${importedMap.size === 1 ? "" : "s"} from ${file.name}.`);
  } catch {
    setModeratorStatus("The selected file could not be imported. Use a JSON file exported from the moderator workspace.", true);
  }
}

function openContents() {
  if (state.currentScene !== "contents") {
    state.returnScene = state.currentScene;
  }

  showScene("contents");
  buildContents();
  window.requestAnimationFrame(() => {
    elements.contentsSearch.focus();
  });
}

function closeContents() {
  const nextScene = state.returnScene || (state.started ? "album" : "cover");
  showScene(nextScene);

  if (state.currentScene === "album") {
    fitImage();
  }
}

function openModerator(regionId = state.moderatorRegionId || REGIONS[0]?.id || "") {
  if (!MODERATOR_ENABLED || !REGIONS.length) {
    return;
  }

  if (state.currentScene !== "moderator") {
    state.returnScene = state.currentScene;
  }

  showScene("moderator");
  populateModeratorForm(regionId);
  buildModeratorDraftList();
}

function closeModerator() {
  if (!MODERATOR_ENABLED) {
    return;
  }

  const nextScene = state.returnScene || (state.started ? "album" : "cover");
  showScene(nextScene);

  if (state.currentScene === "album") {
    fitImage();
  }
}

function previewModeratorRegion() {
  const targetIndex = INDEX_BY_ID.get(elements.moderatorRegion.value);

  if (!Number.isFinite(targetIndex)) {
    return;
  }

  state.started = true;
  showScene("album");
  render(targetIndex);
  closeDrawer();
}

function beginAtlas() {
  if (!REGIONS.length) {
    return;
  }

  state.started = true;
  showScene("album");
  render(state.index);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    return;
  }

  document.exitFullscreen?.();
}

function wireViewportInteractions() {
  let dragState = null;
  const activePointers = new Map();
  let pinchDistance = null;

  elements.viewport.addEventListener(
    "wheel",
    (event) => {
      if (!state.mapReady) {
        return;
      }

      event.preventDefault();
      const bounds = elements.viewport.getBoundingClientRect();
      zoomAt(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        event.deltaY < 0 ? 1.18 : 1 / 1.18
      );
    },
    { passive: false }
  );

  elements.viewport.addEventListener("dblclick", (event) => {
    if (!state.mapReady) {
      return;
    }

    const bounds = elements.viewport.getBoundingClientRect();
    zoomAt(event.clientX - bounds.left, event.clientY - bounds.top, 1.8);
  });

  elements.viewport.addEventListener("pointerdown", (event) => {
    if (!state.mapReady) {
      return;
    }

    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointers.size === 1) {
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: view.x,
        originY: view.y
      };
      elements.viewport.classList.add("grabbing");
    } else {
      dragState = null;
    }

    elements.viewport.setPointerCapture(event.pointerId);
  });

  elements.viewport.addEventListener("pointermove", (event) => {
    if (!state.mapReady || !activePointers.has(event.pointerId)) {
      return;
    }

    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointers.size === 2) {
      const points = Array.from(activePointers.values());
      const distance = Math.hypot(
        points[0].clientX - points[1].clientX,
        points[0].clientY - points[1].clientY
      );
      const bounds = elements.viewport.getBoundingClientRect();
      const centerX = (points[0].clientX + points[1].clientX) / 2 - bounds.left;
      const centerY = (points[0].clientY + points[1].clientY) / 2 - bounds.top;

      if (pinchDistance) {
        zoomAt(centerX, centerY, distance / pinchDistance);
      }

      pinchDistance = distance;
      hideHint();
      return;
    }

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    view.x = dragState.originX + (event.clientX - dragState.startX);
    view.y = dragState.originY + (event.clientY - dragState.startY);
    applyView();
    hideHint();
  });

  function endPointer(event) {
    activePointers.delete(event.pointerId);

    if (dragState && dragState.pointerId === event.pointerId) {
      dragState = null;
    }

    if (activePointers.size < 2) {
      pinchDistance = null;
    }

    if (activePointers.size === 0) {
      elements.viewport.classList.remove("grabbing");
    }
  }

  elements.viewport.addEventListener("pointerup", endPointer);
  elements.viewport.addEventListener("pointercancel", endPointer);
}

function wireEvents() {
  if (elements.atlasSelect) {
    elements.atlasSelect.addEventListener("change", (event) => {
      switchAtlas(event.target.value);
    });
  }

  elements.btnBegin.addEventListener("click", beginAtlas);
  if (elements.btnOpenModerator) {
    elements.btnOpenModerator.addEventListener("click", () => {
      openModerator(state.moderatorRegionId || REGIONS[state.index]?.id || REGIONS[0]?.id || "");
    });
  }
  elements.btnContents.addEventListener("click", () => {
    if (state.currentScene === "contents") {
      closeContents();
      return;
    }

    openContents();
  });
  elements.btnModerator.addEventListener("click", () => {
    if (!MODERATOR_ENABLED) {
      return;
    }

    if (state.currentScene === "moderator") {
      closeModerator();
      return;
    }

    openModerator(state.moderatorRegionId || REGIONS[state.index]?.id || REGIONS[0]?.id || "");
  });
  elements.cClose.addEventListener("click", closeContents);
  elements.moderatorBack.addEventListener("click", closeModerator);
  elements.btnFull.addEventListener("click", toggleFullscreen);
  elements.btnNotes.addEventListener("click", openDrawer);
  elements.drClose.addEventListener("click", closeDrawer);
  elements.scrim.addEventListener("click", closeDrawer);
  elements.prev.addEventListener("click", () => go(-1));
  elements.next.addEventListener("click", () => go(1));
  elements.zoomIn.addEventListener("click", () => {
    zoomAt(elements.viewport.clientWidth / 2, elements.viewport.clientHeight / 2, 1.4);
  });
  elements.zoomOut.addEventListener("click", () => {
    zoomAt(elements.viewport.clientWidth / 2, elements.viewport.clientHeight / 2, 1 / 1.4);
  });
  elements.zoomFit.addEventListener("click", fitImage);

  elements.contentsSearch.addEventListener("input", (event) => {
    state.query = event.target.value;
    buildContents();
  });

  elements.contentsSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const visibleRegions = getVisibleRegions();

      if (visibleRegions.length === 1) {
        jumpToIndex(INDEX_BY_ID.get(visibleRegions[0].id));
      }
    }
  });

  elements.moderatorRegion.addEventListener("change", (event) => {
    populateModeratorForm(event.target.value);
    setModeratorStatus("");
  });

  elements.moderatorPdf.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    const regionId = elements.moderatorRegion.value;

    revokeModeratorPdf(regionId);

    if (!file) {
      populateModeratorForm(regionId);
      return;
    }

    const pdfUrl = URL.createObjectURL(file);
    let pdfBytes = null;

    try {
      pdfBytes = new Uint8Array(await file.arrayBuffer());
      state.moderatorPdfBytes.set(regionId, pdfBytes);
    } catch {
      state.moderatorPdfBytes.delete(regionId);
    }

    state.moderatorPdfUrls.set(regionId, pdfUrl);
    state.moderatorSessionFiles.set(regionId, file);
    state.moderatorPdfPageByRegion.set(regionId, 1);

    if (!elements.moderatorProjectPdfName.value.trim()) {
      elements.moderatorProjectPdfName.value = file.name.replace(/\.pdf$/i, "");
    }

    elements.moderatorFileMeta.textContent = `Current session PDF: ${file.name} · ${formatBytes(file.size)}`;
    updateModeratorPdfPreview(regionId);
    updateModeratorCommand(regionId);

    if (pdfBytes) {
      setModeratorStatus(`Attached ${file.name}. The preview is rendering now; save the draft to record it in the handoff package.`);
      return;
    }

    const hint = getModeratorPreviewEnvironmentHint();
    setModeratorStatus(
      hint
        ? `Attached ${file.name}, but this browser did not allow inline preview bytes to be read. Use Open PDF or Download PDF for now. ${hint}`
        : `Attached ${file.name}, but this browser did not allow inline preview bytes to be read. Use Open PDF or Download PDF, then save the draft to record it in the handoff package.`,
      true
    );
  });

  elements.moderatorPdfPrev.addEventListener("click", () => {
    const regionId = elements.moderatorRegion.value;
    const currentPage = state.moderatorPdfPageByRegion.get(regionId) || 1;
    renderModeratorPdfPage(regionId, currentPage - 1);
  });

  elements.moderatorPdfNext.addEventListener("click", () => {
    const regionId = elements.moderatorRegion.value;
    const currentPage = state.moderatorPdfPageByRegion.get(regionId) || 1;
    renderModeratorPdfPage(regionId, currentPage + 1);
  });

  elements.moderatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveModeratorDraft();
  });

  elements.moderatorArchive.addEventListener("click", archiveModeratorPdfToProject);
  elements.moderatorIntegrate.addEventListener("click", integrateModeratorPdfIntoAtlas);
  elements.moderatorPreview.addEventListener("click", previewModeratorRegion);
  elements.moderatorReset.addEventListener("click", () => {
    deleteModeratorDraft(elements.moderatorRegion.value);
  });
  elements.moderatorExport.addEventListener("click", exportModeratorHandoff);
  elements.moderatorImport.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await importModeratorHandoff(file);
    elements.moderatorImport.value = "";
  });

  elements.moderatorDraftList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action][data-region-id]");

    if (!button) {
      return;
    }

    const regionId = button.dataset.regionId;
    const action = button.dataset.action;

    if (action === "load") {
      openModerator(regionId);
      return;
    }

    if (action === "preview") {
      openModerator(regionId);
      previewModeratorRegion();
      return;
    }

    if (action === "delete") {
      deleteModeratorDraft(regionId);
    }
  });

  document.addEventListener("fullscreenchange", syncFullscreenLabel);
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    if (isTyping) {
      if (event.key === "Escape" && state.currentScene === "contents" && state.query) {
        state.query = "";
        elements.contentsSearch.value = "";
        buildContents();
        event.preventDefault();
      }

      return;
    }

    if (state.currentScene === "cover") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        beginAtlas();
      }

      if (event.key.toLowerCase() === "c") {
        openContents();
      } else if (MODERATOR_ENABLED && event.key.toLowerCase() === "m") {
        openModerator();
      }

      return;
    }

    if (state.currentScene === "contents") {
      if (event.key === "Escape") {
        closeContents();
      } else if (MODERATOR_ENABLED && event.key.toLowerCase() === "m") {
        openModerator();
      }

      return;
    }

    if (state.currentScene === "moderator") {
      if (event.key === "Escape") {
        closeModerator();
      }

      return;
    }

    if (event.key === "ArrowRight") {
      go(1);
    } else if (event.key === "ArrowLeft") {
      go(-1);
    } else if (event.key === "Escape") {
      if (elements.drawer.classList.contains("on")) {
        closeDrawer();
      } else {
        openContents();
      }
    } else if (event.key.toLowerCase() === "i") {
      if (elements.drawer.classList.contains("on")) {
        closeDrawer();
      } else {
        openDrawer();
      }
    } else if (event.key.toLowerCase() === "c") {
      openContents();
    } else if (MODERATOR_ENABLED && event.key.toLowerCase() === "m") {
      openModerator();
    } else if (event.key.toLowerCase() === "f") {
      toggleFullscreen();
    }
  });

  window.addEventListener("resize", fitImage);
  wireViewportInteractions();
}

if (ATLAS_COLLECTIONS.length) {
  populateAtlasOptions();
  updateOverview();
  syncModeratorAvailability();
  syncModeratorPreviewHint();

  if (REGIONS.length) {
    setTheme(getEffectiveRegion(REGIONS[0]) || REGIONS[0]);
    populateModeratorRegionOptions();
    populateModeratorForm(state.moderatorRegionId || REGIONS[0].id);
    buildFilmstrip();
    buildContents();
    buildModeratorDraftList();
    syncNavigation();
  }

  syncFullscreenLabel();
  wireEvents();
}
