const ATLAS_CONFIG = window.ATLAS_CONFIG || {};
const MODERATOR_DRAFTS = Array.isArray(window.MODERATOR_DRAFTS) ? window.MODERATOR_DRAFTS : [];
const SOURCE_LIBRARY = Array.isArray(window.SOURCE_LIBRARY) ? window.SOURCE_LIBRARY : [];
const PDFJS_LIB = window.pdfjsLib || null;
const MODERATOR_STORAGE_KEY = "atlasModeratorDraftsV2";
const LEGACY_MODERATOR_STORAGE_KEY = "atlasModeratorDraftsV1";
const LEGACY_SOURCE_LIBRARY_NOTES_KEY = "atlasSourceLibraryNotesV1";
const SOURCE_LIBRARY_NOTES_KEY = "atlasSourceLibraryNotesV2";
const SOURCE_LIBRARY_AI_KEY = "atlasSourceLibraryAiV1";
const MODERATOR_ENABLED = ATLAS_CONFIG.showModerator === true;
const USE_BROWSER_DRAFTS = ATLAS_CONFIG.useBrowserDrafts !== false;
const MODERATOR_PDF_PREVIEW_MAX_SCALE = 2.25;
const SOURCE_LIBRARY_PREVIEW_MAX_SCALE = 3;
const SOURCE_LIBRARY_MIN_ZOOM = 0.55;
const SOURCE_LIBRARY_MAX_ZOOM = 3.2;
const SOURCE_REPORT_THUMBNAIL_WIDTH = 460;
const LIBRARY_AI_DEFAULT_PROXY_ORIGIN = "http://127.0.0.1:8010";
const LIBRARY_AI_IMAGE_MAX_DIMENSION = 1600;
const LIBRARY_AI_IMAGE_QUALITY = 0.72;
const CLIMATE_MAP_KEYWORDS = [
  "agroclimatic",
  "air temperature",
  "atmospheric precipitation",
  "atmospheric pressure",
  "clear-sky",
  "climate",
  "climate types",
  "climate water deficit",
  "expected precipitation",
  "expected temperature",
  "frost",
  "growing season",
  "humidity",
  "hydrometeorological",
  "local climate zones",
  "mean air temperature",
  "meteorological",
  "precipitation",
  "projected climate",
  "snow cover",
  "solar radiation",
  "sunshine",
  "temperature change",
  "temperature trend",
  "weather hazards",
  "wind conditions"
];
const CLIMATE_MAP_EXCLUDED_KEYWORDS = ["cover", "introduction", "photo", "photos", "table", "text"];
const MODERATOR_ATLAS_RENDER_MAX_SCALE = 4;
const MODERATOR_ATLAS_RENDER_MAX_WIDTH = 2200;
const MODERATOR_ATLAS_RENDER_MAX_HEIGHT = 3000;
const BROWSER_STORAGE_ATLAS_PREVIEW_MAX_CHARS = 280000;
const BROWSER_STORAGE_ATLAS_PREVIEW_TARGET_WIDTHS = [1400, 1100, 850, 640, 480];
const BROWSER_STORAGE_ATLAS_PREVIEW_QUALITIES = [0.78, 0.66, 0.54, 0.42];
const PROJECT_PDFS_FOLDER = "pdfs";
const MODERATOR_PROJECT_ARCHIVE_FOLDER = "moderator-library";
const MODERATOR_PROJECT_ARCHIVE_PATH = `${PROJECT_PDFS_FOLDER}/${MODERATOR_PROJECT_ARCHIVE_FOLDER}`;
const MODERATOR_PROJECT_MANIFEST_FILE = "atlas-project-memory.json";
const MODERATOR_PROJECT_PREVIEW_FOLDER = "atlas-previews";
const MODERATOR_PROJECT_PREVIEW_PATH = `${MODERATOR_PROJECT_ARCHIVE_PATH}/${MODERATOR_PROJECT_PREVIEW_FOLDER}`;
const MODERATOR_PROJECT_HISTORY_FOLDER = "draft-history";
const MODERATOR_PROJECT_HISTORY_PATH = `${MODERATOR_PROJECT_ARCHIVE_PATH}/${MODERATOR_PROJECT_HISTORY_FOLDER}`;
const DEFAULT_PLATE_TYPE = "Atlas plate";
const DEFAULT_PLATE_SCALE = "Curated plate";
const DEFAULT_CUSTOM_PLATE_PALETTE = ["#8e5a34", "#2f776d", "#d3b064"];
const PROJECT_ARCHIVE_ROOT_ERROR_MESSAGE = "Choose the atlas repo root, archive folder, atlas-previews folder, current atlas folder, a single plate package, or an empty project workspace.";
const PROJECT_ARCHIVE_CONNECTION_PROJECT_ROOT = "project-root";
const PROJECT_ARCHIVE_CONNECTION_ARCHIVE_PARENT = "archive-parent";
const PROJECT_ARCHIVE_CONNECTION_ARCHIVE_ROOT = "archive-root";
const PROJECT_ARCHIVE_CONNECTION_WORKSPACE = "workspace";
const PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT = "previews-root";
const PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER = "atlas-folder";
const PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE = "plate-package";
const PROJECT_ARCHIVE_HANDLE_DB_NAME = "atlas-project-archive";
const PROJECT_ARCHIVE_HANDLE_STORE_NAME = "handles";
const PROJECT_ARCHIVE_HANDLE_STORAGE_KEY = "current";

function buildIndex(regions) {
  return new Map((regions || []).map((region, index) => [region.id, index]));
}

function createProjectArchiveRootError(message = PROJECT_ARCHIVE_ROOT_ERROR_MESSAGE) {
  const error = new Error(message);
  error.name = "ProjectArchiveRootError";
  return error;
}

function createIndexedDbRequestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("IndexedDB request failed."));
    };
  });
}

function createIndexedDbTransactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onabort = transaction.onerror = () => {
      reject(transaction.error || new Error("IndexedDB transaction failed."));
    };
  });
}

async function openProjectArchiveHandleDatabase() {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROJECT_ARCHIVE_HANDLE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PROJECT_ARCHIVE_HANDLE_STORE_NAME)) {
        request.result.createObjectStore(PROJECT_ARCHIVE_HANDLE_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Could not open IndexedDB."));
    };
  });
}

async function storeProjectArchiveRootHandle(handle) {
  const database = await openProjectArchiveHandleDatabase();

  if (!database) {
    return;
  }

  try {
    const transaction = database.transaction(PROJECT_ARCHIVE_HANDLE_STORE_NAME, "readwrite");
    const objectStore = transaction.objectStore(PROJECT_ARCHIVE_HANDLE_STORE_NAME);

    if (handle) {
      objectStore.put(handle, PROJECT_ARCHIVE_HANDLE_STORAGE_KEY);
    } else {
      objectStore.delete(PROJECT_ARCHIVE_HANDLE_STORAGE_KEY);
    }

    await createIndexedDbTransactionPromise(transaction);
  } finally {
    database.close();
  }
}

async function loadStoredProjectArchiveRootHandle() {
  const database = await openProjectArchiveHandleDatabase();

  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(PROJECT_ARCHIVE_HANDLE_STORE_NAME, "readonly");
    const objectStore = transaction.objectStore(PROJECT_ARCHIVE_HANDLE_STORE_NAME);
    const handle = await createIndexedDbRequestPromise(objectStore.get(PROJECT_ARCHIVE_HANDLE_STORAGE_KEY));

    await createIndexedDbTransactionPromise(transaction);
    return handle || null;
  } finally {
    database.close();
  }
}

async function hasProjectArchiveHandlePermission(handle, mode = "read") {
  if (!handle?.queryPermission) {
    return true;
  }

  try {
    return (await handle.queryPermission({ mode })) === "granted";
  } catch {
    return false;
  }
}

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

function normalizeSourceDocument(rawDocument) {
  if (!rawDocument || typeof rawDocument !== "object") {
    return null;
  }

  const id = String(rawDocument.id || rawDocument.path || "").trim();
  const path = String(rawDocument.path || "").trim();
  const title = String(rawDocument.title || rawDocument.fileName || id).trim();

  if (!id || !path || !title) {
    return null;
  }

  return {
    id,
    title,
    alias: String(rawDocument.alias || rawDocument.englishTitle || "").trim(),
    path,
    fileName: String(rawDocument.fileName || "").trim(),
    folder: String(rawDocument.folder || "").trim(),
    category: String(rawDocument.category || "document").trim(),
    categoryLabel: String(rawDocument.categoryLabel || "Document").trim(),
    collection: String(rawDocument.collection || "Source library").trim(),
    collectionId: String(rawDocument.collectionId || rawDocument.category || "documents").trim(),
    sizeLabel: String(rawDocument.sizeLabel || "").trim(),
    year: String(rawDocument.year || "").trim(),
    partner: String(rawDocument.partner || "").trim(),
    prefix: String(rawDocument.prefix || "").trim(),
    topics: Array.isArray(rawDocument.topics) ? rawDocument.topics.map(String).filter(Boolean) : [],
    keywords: Array.isArray(rawDocument.keywords) ? rawDocument.keywords.map(String).filter(Boolean) : [],
    order: Number.isFinite(Number(rawDocument.order)) ? Number(rawDocument.order) : 99999
  };
}

const SOURCE_DOCUMENTS = SOURCE_LIBRARY.map(normalizeSourceDocument)
  .filter(Boolean)
  .sort((left, right) => {
    if (left.collectionId === right.collectionId) {
      return left.order - right.order || left.title.localeCompare(right.title);
    }

    const collectionOrder = ["reports", "regional-maps", "thematic-maps", "drivers-of-change", "climate-chapter", "source-atlases"];
    const leftOrder = collectionOrder.indexOf(left.collectionId);
    const rightOrder = collectionOrder.indexOf(right.collectionId);

    return (leftOrder === -1 ? 999 : leftOrder) - (rightOrder === -1 ? 999 : rightOrder);
  });

let activeAtlas = null;
let BASE_REGIONS = [];
let BASE_INDEX_BY_ID = new Map();
let REGIONS = [];
let ATLAS_GLOSSARY = [];
let ATLAS_OVERVIEW = {};
let INDEX_BY_ID = new Map();

function getAtlasById(atlasId) {
  return ATLAS_COLLECTIONS.find((atlas) => atlas.id === atlasId) || ATLAS_COLLECTIONS[0] || null;
}

function setActiveAtlasData(atlasId) {
  activeAtlas = getAtlasById(atlasId);
  BASE_REGIONS = activeAtlas?.regions || [];
  BASE_INDEX_BY_ID = buildIndex(BASE_REGIONS);
  REGIONS = [...BASE_REGIONS];
  ATLAS_GLOSSARY = activeAtlas?.glossary || [];
  ATLAS_OVERVIEW = activeAtlas?.overview || {};
  INDEX_BY_ID = buildIndex(REGIONS);
  return activeAtlas;
}

function getActiveAtlasId() {
  return activeAtlas?.id || "";
}

function getActiveAtlasName() {
  return activeAtlas?.name || "Atlas";
}

function getRegionSortIndex(regionId, customOrder = 0) {
  const baseIndex = BASE_INDEX_BY_ID.get(regionId);

  if (Number.isFinite(baseIndex)) {
    return baseIndex;
  }

  return BASE_REGIONS.length + Math.max(0, Number(customOrder) || 0);
}

function buildCustomPlateName(regionId) {
  return String(regionId || "new-plate")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildCustomPlateFromDraft(draft) {
  const plateId = String(draft?.regionId || "").trim();

  if (!plateId) {
    return null;
  }

  return {
    id: plateId,
    name: String(draft?.name || buildCustomPlateName(plateId)).trim(),
    uz: String(draft?.uz || "").trim(),
    type: String(draft?.type || DEFAULT_PLATE_TYPE).trim() || DEFAULT_PLATE_TYPE,
    scale: String(draft?.scale || DEFAULT_PLATE_SCALE).trim() || DEFAULT_PLATE_SCALE,
    caption: String(draft?.caption || "New atlas plate draft.").trim(),
    map: String(draft?.map || `assets/maps/${plateId}.jpg`).trim(),
    palette: DEFAULT_CUSTOM_PLATE_PALETTE,
    summary: String(draft?.summary || "Add a description, source PDF, and atlas preview for this new plate.").trim(),
    themes: [],
    facts: [],
    isCustomPlate: true,
    customOrder: Number(draft?.customOrder) || 0
  };
}

function rebuildEffectiveRegionRegistry(draftMap = state?.moderatorDrafts || new Map()) {
  const customRegions = Array.from(draftMap.values())
    .filter((draft) => draft?.isCustomPlate)
    .sort((left, right) => getRegionSortIndex(left.regionId, left.customOrder) - getRegionSortIndex(right.regionId, right.customOrder))
    .map((draft) => buildCustomPlateFromDraft(draft))
    .filter(Boolean);

  REGIONS = [...BASE_REGIONS, ...customRegions];
  INDEX_BY_ID = buildIndex(REGIONS);
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
  climateMapQuery: "",
  libraryQuery: "",
  libraryCollection: "all",
  librarySelectedId: "",
  libraryNotes: loadSourceLibraryNotes(),
  libraryAiCache: loadLibraryAiCache(),
  libraryPdfDocumentId: "",
  libraryPdfLoadingTask: null,
  libraryPdfDocument: null,
  libraryPage: 1,
  libraryPageCount: 0,
  libraryZoom: 1,
  libraryRenderTask: null,
  libraryRenderToken: 0,
  libraryNoteSaveTimer: null,
  libraryAiAbortController: null,
  libraryAiRequestToken: 0,
  libraryAiBusy: false,
  libraryAiStartedAt: 0,
  libraryAiLastDurationMs: 0,
  libraryAiTimerId: null,
  libraryAiAvatarMood: "",
  libraryAiAvatarTipIndex: 0,
  libraryAiAvatarReactionTimer: null,
  libraryPageTextCache: new Map(),
  reportThumbnailCache: new Map(),
  reportThumbnailPromises: new Map(),
  reportThumbnailObserver: null,
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
  projectArchiveRootHandle: null,
  projectArchiveConnectionMode: ""
};

rebuildEffectiveRegionRegistry(state.moderatorDrafts);

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
  climateMaps: document.querySelector("#climate-maps"),
  library: document.querySelector("#library"),
  moderator: document.querySelector("#moderator"),
  metricPlates: document.querySelector("#metric-plates"),
  metricPlatesLabel: document.querySelector("#metric-plates-label"),
  metricRivers: document.querySelector("#metric-rivers"),
  metricRiversLabel: document.querySelector("#metric-rivers-label"),
  metricSea: document.querySelector("#metric-sea"),
  metricSeaLabel: document.querySelector("#metric-sea-label"),
  btnBegin: document.querySelector("#btnBegin"),
  btnOpenLibrary: document.querySelector("#btnOpenLibrary"),
  btnOpenClimateMaps: document.querySelector("#btnOpenClimateMaps"),
  btnOpenModerator: document.querySelector("#btnOpenModerator"),
  btnContents: document.querySelector("#btnContents"),
  btnLibrary: document.querySelector("#btnLibrary"),
  btnClimateMaps: document.querySelector("#btnClimateMaps"),
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
  climateMapsClose: document.querySelector("#climate-maps-close"),
  climateMapsSearch: document.querySelector("#climate-maps-search"),
  climateMapsCount: document.querySelector("#climate-maps-count"),
  climateMapsStats: document.querySelector("#climate-maps-stats"),
  climateMapsGrid: document.querySelector("#climate-maps-grid"),
  libraryClose: document.querySelector("#library-close"),
  libraryStats: document.querySelector("#library-stats"),
  librarySearch: document.querySelector("#library-search"),
  libraryCategory: document.querySelector("#library-category"),
  libraryCount: document.querySelector("#library-count"),
  libraryList: document.querySelector("#library-list"),
  libraryDocKicker: document.querySelector("#library-doc-kicker"),
  libraryDocTitle: document.querySelector("#library-doc-title"),
  libraryDocMeta: document.querySelector("#library-doc-meta"),
  libraryOpenPdf: document.querySelector("#library-open-pdf"),
  libraryPdfStage: document.querySelector("#library-pdf-stage"),
  libraryPdfEmpty: document.querySelector("#library-pdf-empty"),
  libraryCanvasShell: document.querySelector("#library-canvas-shell"),
  libraryCanvas: document.querySelector("#library-canvas"),
  libraryPage: document.querySelector("#library-page"),
  libraryPrev: document.querySelector("#library-prev"),
  libraryNext: document.querySelector("#library-next"),
  libraryZoomOut: document.querySelector("#library-zoom-out"),
  libraryZoomIn: document.querySelector("#library-zoom-in"),
  libraryZoomFit: document.querySelector("#library-zoom-fit"),
  libraryAiPanel: document.querySelector("#library-ai-panel"),
  libraryAiExplain: document.querySelector("#library-ai-explain"),
  libraryAiExplainLabel: document.querySelector("#library-ai-explain-label"),
  libraryAiAvatar: document.querySelector("#library-ai-avatar"),
  libraryAiChipLabel: document.querySelector("#library-ai-chip-label"),
  libraryAiAvatarLine: document.querySelector("#library-ai-avatar-line"),
  libraryAiTimer: document.querySelector("#library-ai-timer"),
  libraryAiCopy: document.querySelector("#library-ai-copy"),
  libraryAiStatus: document.querySelector("#library-ai-status"),
  libraryAiPlaceholder: document.querySelector("#library-ai-placeholder"),
  libraryAiText: document.querySelector("#library-ai-text"),
  libraryNote: document.querySelector("#library-note"),
  libraryNoteStatus: document.querySelector("#library-note-status"),
  moderatorBack: document.querySelector("#moderator-back"),
  moderatorForm: document.querySelector("#moderator-form"),
  moderatorAddPlate: document.querySelector("#moderator-add-plate"),
  moderatorRegion: document.querySelector("#moderator-region"),
  moderatorPlateKey: document.querySelector("#moderator-plate-key"),
  moderatorPlateName: document.querySelector("#moderator-plate-name"),
  moderatorPlateUz: document.querySelector("#moderator-plate-uz"),
  moderatorPlateType: document.querySelector("#moderator-plate-type"),
  moderatorPlateScale: document.querySelector("#moderator-plate-scale"),
  moderatorPlateMap: document.querySelector("#moderator-plate-map"),
  moderatorPdf: document.querySelector("#moderator-pdf"),
  moderatorProjectPdfName: document.querySelector("#moderator-project-pdf-name"),
  moderatorProjectRoot: document.querySelector("#moderator-project-root"),
  moderatorProjectRootMeta: document.querySelector("#moderator-project-root-meta"),
  moderatorFileMeta: document.querySelector("#moderator-file-meta"),
  moderatorPreviewHint: document.querySelector("#moderator-preview-hint"),
  moderatorCaption: document.querySelector("#moderator-caption"),
  moderatorSummary: document.querySelector("#moderator-summary"),
  moderatorNote: document.querySelector("#moderator-note"),
  moderatorArchive: document.querySelector("#moderator-archive"),
  moderatorIntegrate: document.querySelector("#moderator-integrate"),
  moderatorPreview: document.querySelector("#moderator-preview"),
  moderatorDeletePlate: document.querySelector("#moderator-delete-plate"),
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
  const isCustomPlate = Boolean(rawDraft.isCustomPlate) || !BASE_INDEX_BY_ID.has(regionId);

  if (!regionId || draftAtlasId !== atlasId) {
    return null;
  }

  const normalized = {
    atlasId: draftAtlasId,
    regionId,
    isCustomPlate,
    name: String(rawDraft.name || rawDraft.regionName || rawDraft.title || "").trim(),
    uz: String(rawDraft.uz || rawDraft.localName || "").trim(),
    type: String(rawDraft.type || "").trim(),
    scale: String(rawDraft.scale || "").trim(),
    map: String(rawDraft.map || rawDraft.mapPath || "").trim(),
    customOrder: Number.isFinite(Number(rawDraft.customOrder))
      ? Math.max(0, Math.round(Number(rawDraft.customOrder)))
      : 0,
    caption: String(rawDraft.caption || "").trim(),
    summary: String(rawDraft.summary || "").trim(),
    moderatorNote: String(rawDraft.moderatorNote || rawDraft.note || "").trim(),
    sourcePdf: String(rawDraft.sourcePdf || rawDraft.pdfName || "").trim(),
    sourceFileSize: String(rawDraft.sourceFileSize || "").trim(),
    projectPdfName: String(rawDraft.projectPdfName || rawDraft.projectPdfFileName || "").trim(),
    projectPdfPath: String(rawDraft.projectPdfPath || "").trim(),
    projectPdfSavedAt: String(rawDraft.projectPdfSavedAt || "").trim(),
    projectDraftPath: String(rawDraft.projectDraftPath || rawDraft.descriptionPath || "").trim(),
    projectDraftSavedAt: String(rawDraft.projectDraftSavedAt || "").trim(),
    atlasPreviewPath: String(rawDraft.atlasPreviewPath || rawDraft.atlasPreviewFile || "").trim(),
    atlasPreviewSavedAt: String(rawDraft.atlasPreviewSavedAt || "").trim(),
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

function serializeDraftForBrowserStorage(draft) {
  const serializedDraft = { ...draft };

  if (serializedDraft.atlasPreviewStorageImage) {
    serializedDraft.atlasPreviewImage = serializedDraft.atlasPreviewStorageImage;
  }

  delete serializedDraft.atlasPreviewStorageImage;
  return serializedDraft;
}

function serializeDraftMap(draftMap) {
  return Array.from(draftMap.values())
    .sort((left, right) => {
      const leftIndex = getRegionSortIndex(left.regionId, left.customOrder);
      const rightIndex = getRegionSortIndex(right.regionId, right.customOrder);
      return leftIndex - rightIndex;
    })
    .map((draft) => serializeDraftForBrowserStorage(draft));
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

function loadSourceLibraryNotes() {
  const emptyPayload = {
    documents: {},
    pages: {}
  };

  const normalizeStringRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value).reduce((record, [key, item]) => {
      const normalizedKey = String(key || "").trim();
      const normalizedValue = String(item || "").trim();

      if (normalizedKey && normalizedValue) {
        record[normalizedKey] = normalizedValue;
      }

      return record;
    }, {});
  };

  const normalizePageRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value).reduce((record, [documentId, pages]) => {
      const normalizedDocumentId = String(documentId || "").trim();
      const normalizedPages = normalizeStringRecord(pages);

      if (normalizedDocumentId && Object.keys(normalizedPages).length) {
        record[normalizedDocumentId] = normalizedPages;
      }

      return record;
    }, {});
  };

  const normalizeNotesPayload = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ...emptyPayload };
    }

    return {
      documents: normalizeStringRecord(value.documents),
      pages: normalizePageRecord(value.pages)
    };
  };

  try {
    const raw = window.localStorage.getItem(SOURCE_LIBRARY_NOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (parsed) {
      return normalizeNotesPayload(parsed);
    }
  } catch {
    return { ...emptyPayload };
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_SOURCE_LIBRARY_NOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return {
      documents:
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? Object.entries(parsed).reduce((record, [documentId, note]) => {
              const normalizedDocumentId = String(documentId || "").trim();
              const normalizedNote = String(note || "").trim();

              if (normalizedDocumentId && normalizedNote) {
                record[normalizedDocumentId] = normalizedNote;
              }

              return record;
            }, {})
          : {},
      pages: {}
    };
  } catch {
    return { ...emptyPayload };
  }
}

function persistSourceLibraryNotes() {
  try {
    window.localStorage.setItem(SOURCE_LIBRARY_NOTES_KEY, JSON.stringify(state.libraryNotes));
  } catch {
    if (elements.libraryNoteStatus) {
      elements.libraryNoteStatus.textContent = "Notes could not be saved in this browser.";
      elements.libraryNoteStatus.classList.add("is-alert");
    }
  }
}

function loadLibraryAiCache() {
  try {
    const raw = window.localStorage.getItem(SOURCE_LIBRARY_AI_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce((record, [key, value]) => {
      const normalizedKey = String(key || "").trim();
      const text = String(value?.text || "").trim();

      if (!normalizedKey || !text) {
        return record;
      }

      record[normalizedKey] = {
        text,
        updatedAt: String(value?.updatedAt || "").trim(),
        model: String(value?.model || "").trim()
      };
      return record;
    }, {});
  } catch {
    return {};
  }
}

function persistLibraryAiCache() {
  try {
    window.localStorage.setItem(SOURCE_LIBRARY_AI_KEY, JSON.stringify(state.libraryAiCache));
  } catch {
    if (elements.libraryAiStatus) {
      elements.libraryAiStatus.textContent = "AI explanations could not be cached in this browser.";
      elements.libraryAiStatus.classList.add("is-alert");
    }
  }
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

function hasSavedAtlasPreview(source) {
  return Boolean(source?.atlasPreviewPath || source?.atlasPreviewImage);
}

function buildProjectArchiveManifest(draftMap) {
  return {
    version: 1,
    atlasId: getActiveAtlasId(),
    atlasName: getActiveAtlasName(),
    updatedAt: new Date().toISOString(),
    archiveFolder: MODERATOR_PROJECT_ARCHIVE_PATH,
    drafts: serializeDraftMap(draftMap).map((draft) => {
      const region = getDraftRegionSnapshot(draft);

      return {
        atlasId: draft.atlasId || getActiveAtlasId(),
        regionId: draft.regionId,
        isCustomPlate: Boolean(draft.isCustomPlate),
        regionName: region?.name || draft.regionId,
        uz: region?.uz || draft.uz || "",
        type: region?.type || draft.type || "",
        scale: region?.scale || draft.scale || "",
        map: region?.map || draft.map || "",
        sourcePdf: draft.sourcePdf || "",
        sourceFileSize: draft.sourceFileSize || "",
        projectPdfName: draft.projectPdfName || "",
        projectPdfPath: draft.projectPdfPath || "",
        projectPdfSavedAt: draft.projectPdfSavedAt || "",
        projectDraftPath: draft.projectDraftPath || "",
        projectDraftSavedAt: draft.projectDraftSavedAt || "",
        caption: draft.caption || "",
        summary: draft.summary || "",
        moderatorNote: draft.moderatorNote || "",
        atlasPreviewPath: draft.atlasPreviewPath || "",
        atlasPreviewSavedAt: draft.atlasPreviewSavedAt || "",
        atlasPreviewPage: draft.atlasPreviewPage || 0,
        atlasPreviewSaved: hasSavedAtlasPreview(draft),
        updatedAt: draft.updatedAt || ""
      };
    })
  };
}

function buildTimestampToken(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function buildProjectPreviewFileName(regionId, pageNumber = 1) {
  const slug = slugifyProjectPdfName(regionId) || "atlas-preview";
  return `${slug}-page-${String(Math.max(1, Number(pageNumber) || 1)).padStart(2, "0")}.jpg`;
}

function buildProjectPlatePackagePath(regionId, atlasId = getActiveAtlasId()) {
  return `${MODERATOR_PROJECT_PREVIEW_PATH}/${atlasId}/${regionId}`;
}

function buildProjectPreviewPath(regionId, pageNumber = 1, atlasId = getActiveAtlasId()) {
  return `${buildProjectPlatePackagePath(regionId, atlasId)}/${buildProjectPreviewFileName(regionId, pageNumber)}`;
}

function buildProjectDraftLatestPath(regionId, atlasId = getActiveAtlasId()) {
  return `${buildProjectPlatePackagePath(regionId, atlasId)}/latest.json`;
}

function buildProjectPdfPath(regionId, fileName, atlasId = getActiveAtlasId()) {
  return `${buildProjectPlatePackagePath(regionId, atlasId)}/${fileName}`;
}

function buildModeratorHistoryPayload(draft, reason = "draft-save", options = {}) {
  const region = getDraftRegionSnapshot(draft) || buildCustomPlateFromDraft(draft) || {};

  return {
    version: 1,
    reason,
    savedAt: new Date().toISOString(),
    atlasId: draft.atlasId || getActiveAtlasId(),
    atlasName: getActiveAtlasName(),
    deleted: Boolean(options.deleted),
    deletedAt: options.deleted ? new Date().toISOString() : "",
    plate: {
      regionId: draft.regionId,
      name: region.name || draft.name || draft.regionId,
      uz: region.uz || draft.uz || "",
      type: region.type || draft.type || DEFAULT_PLATE_TYPE,
      scale: region.scale || draft.scale || DEFAULT_PLATE_SCALE,
      map: region.map || draft.map || "",
      isCustomPlate: Boolean(draft.isCustomPlate),
      sourcePdf: draft.sourcePdf || "",
      sourceFileSize: draft.sourceFileSize || "",
      projectPdfName: draft.projectPdfName || "",
      projectPdfPath: draft.projectPdfPath || "",
      atlasPreviewPath: draft.atlasPreviewPath || "",
      atlasPreviewPage: draft.atlasPreviewPage || 0,
      caption: draft.caption || "",
      summary: draft.summary || "",
      moderatorNote: draft.moderatorNote || "",
      updatedAt: draft.updatedAt || ""
    }
  };
}

async function directoryHandleContainsFile(handle, fileName) {
  try {
    await handle.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

async function directoryHandleContainsDirectory(handle, directoryName) {
  try {
    await handle.getDirectoryHandle(directoryName);
    return true;
  } catch {
    return false;
  }
}

async function getExistingArchiveSubdirectoryHandle(baseHandle, pathSegments) {
  let currentHandle = baseHandle;

  for (const segment of pathSegments) {
    currentHandle = await currentHandle.getDirectoryHandle(segment);
  }

  return currentHandle;
}

async function readArchiveTextFile(directoryHandle, fileName) {
  try {
    const fileHandle = await directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return "";
  }
}

async function readArchiveJsonFile(directoryHandle, fileName) {
  const text = await readArchiveTextFile(directoryHandle, fileName);

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getProjectArchiveConnectionMode(handle, atlasId = getActiveAtlasId()) {
  if (!handle) {
    return "";
  }

  if ((await directoryHandleContainsFile(handle, "index.html")) || (await directoryHandleContainsFile(handle, "package.json"))) {
    return PROJECT_ARCHIVE_CONNECTION_PROJECT_ROOT;
  }

  const handleName = String(handle.name || "").trim().toLowerCase();
  const atlasFolderName = String(atlasId || getActiveAtlasId() || "").trim().toLowerCase();

  if (await getExistingArchiveSubdirectoryHandle(handle, [PROJECT_PDFS_FOLDER, MODERATOR_PROJECT_ARCHIVE_FOLDER]).then(() => true).catch(() => false)) {
    return PROJECT_ARCHIVE_CONNECTION_ARCHIVE_PARENT;
  }

  if (
    (await directoryHandleContainsFile(handle, MODERATOR_PROJECT_MANIFEST_FILE)) ||
    (await directoryHandleContainsDirectory(handle, MODERATOR_PROJECT_PREVIEW_FOLDER)) ||
    (await directoryHandleContainsDirectory(handle, MODERATOR_PROJECT_HISTORY_FOLDER))
  ) {
    return PROJECT_ARCHIVE_CONNECTION_ARCHIVE_ROOT;
  }

  if (handleName === MODERATOR_PROJECT_PREVIEW_FOLDER && atlasFolderName) {
    try {
      await handle.getDirectoryHandle(atlasFolderName);
      return PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT;
    } catch {
      return PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT;
    }
  }

  if (handleName && atlasFolderName && handleName === atlasFolderName) {
    return PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER;
  }

  if (await directoryHandleContainsFile(handle, "latest.json")) {
    const latestPayload = await readArchiveJsonFile(handle, "latest.json");
    const latestAtlasId = normalizeAtlasId(latestPayload?.atlasId || latestPayload?.plate?.atlasId || atlasId, atlasId || "atlas");

    return !atlasFolderName || latestAtlasId === atlasFolderName
      ? PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE
      : "";
  }

  return PROJECT_ARCHIVE_CONNECTION_WORKSPACE;
}

async function isValidProjectArchiveRootHandle(handle, atlasId = getActiveAtlasId()) {
  return Boolean(await getProjectArchiveConnectionMode(handle, atlasId));
}

let projectArchiveRootHandleRestorePromise = null;

async function restoreStoredProjectArchiveRootHandle(atlasId = getActiveAtlasId()) {
  if (state.projectArchiveRootHandle) {
    return state.projectArchiveRootHandle;
  }

  if (!projectArchiveRootHandleRestorePromise) {
    projectArchiveRootHandleRestorePromise = (async () => {
      try {
        const storedHandle = await loadStoredProjectArchiveRootHandle();

        if (!storedHandle || !(await hasProjectArchiveHandlePermission(storedHandle, "read"))) {
          return null;
        }

        const storedMode = await getProjectArchiveConnectionMode(storedHandle, atlasId);

        if (!storedMode) {
          await storeProjectArchiveRootHandle(null);
          return null;
        }

        state.projectArchiveRootHandle = storedHandle;
        state.projectArchiveConnectionMode = storedMode;
        return storedHandle;
      } catch {
        return null;
      }
    })().finally(() => {
      projectArchiveRootHandleRestorePromise = null;
    });
  }

  return projectArchiveRootHandleRestorePromise;
}

async function getProjectArchiveDirectoryHandle(prompt = true) {
  if (typeof window.showDirectoryPicker !== "function") {
    return null;
  }

  const existingMode = await getProjectArchiveConnectionMode(state.projectArchiveRootHandle);

  if (!existingMode) {
    state.projectArchiveRootHandle = null;
    state.projectArchiveConnectionMode = "";
  } else {
    state.projectArchiveConnectionMode = existingMode;
  }

  if (!state.projectArchiveRootHandle) {
    await restoreStoredProjectArchiveRootHandle();
  }

  if (!state.projectArchiveRootHandle) {
    if (!prompt) {
      return null;
    }

    const pickedHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    const pickedMode = await getProjectArchiveConnectionMode(pickedHandle);

    if (!pickedMode) {
      throw createProjectArchiveRootError();
    }

    state.projectArchiveRootHandle = pickedHandle;
    state.projectArchiveConnectionMode = pickedMode;
    await storeProjectArchiveRootHandle(pickedHandle);
  }

  const rootHandle = state.projectArchiveRootHandle;

  if (
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ARCHIVE_ROOT ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_WORKSPACE ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE
  ) {
    return rootHandle;
  }

  const pdfsHandle = await rootHandle.getDirectoryHandle(PROJECT_PDFS_FOLDER, { create: true });

  return pdfsHandle.getDirectoryHandle(MODERATOR_PROJECT_ARCHIVE_FOLDER, { create: true });
}

async function getArchiveSubdirectoryHandle(baseHandle, pathSegments) {
  let currentHandle = baseHandle;

  for (const segment of pathSegments) {
    currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true });
  }

  return currentHandle;
}

async function getProjectPlatePackageHandle(archiveHandle, regionId, atlasId = getActiveAtlasId()) {
  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE) {
    const latestPayload = await readArchiveJsonFile(archiveHandle, "latest.json");
    const packageRegionId = String(latestPayload?.plate?.regionId || latestPayload?.regionId || archiveHandle.name || "").trim();

    if (packageRegionId && packageRegionId !== regionId) {
      throw createProjectArchiveRootError(`The connected plate package is for ${packageRegionId}; choose a package for ${regionId} or connect a parent archive folder.`);
    }

    return archiveHandle;
  }

  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT) {
    return getArchiveSubdirectoryHandle(archiveHandle, [atlasId, regionId]);
  }

  return getArchiveSubdirectoryHandle(
    archiveHandle,
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER
      ? [regionId]
      : [MODERATOR_PROJECT_PREVIEW_FOLDER, atlasId, regionId]
  );
}

async function writeArchiveFile(fileHandle, contents) {
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function writeArchiveTextFile(directoryHandle, fileName, text) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  await writeArchiveFile(fileHandle, text);
}

async function writeArchiveBlobFile(directoryHandle, fileName, blob) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  await writeArchiveFile(fileHandle, blob);
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function fileToDataUrl(file) {
  if (!file) {
    return "";
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(reader.error || new Error("Could not read file."));
    };

    reader.readAsDataURL(file);
  });
}

function getFileNameFromPath(path, fallback = "") {
  const normalizedPath = String(path || "").trim().split("?")[0].split("#")[0];
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  return pathSegments[pathSegments.length - 1] || fallback;
}

function getResolvedProjectPdfFileName(regionId, sources = []) {
  const preferredValue = [
    elements.moderatorProjectPdfName?.value,
    ...sources.map((source) => source?.projectPdfName),
    ...sources.map((source) => getFileNameFromPath(source?.projectPdfPath || "")),
    ...sources.map((source) => source?.sourcePdf)
  ].find((value) => String(value || "").trim());

  return buildProjectPdfFileName(preferredValue || regionId, regionId);
}

async function resolveModeratorProjectPdfFile(regionId, sources = []) {
  const sessionFile = state.moderatorSessionFiles.get(regionId);

  if (sessionFile) {
    return sessionFile;
  }

  const fileName = getResolvedProjectPdfFileName(regionId, sources);
  const pdfBytes = state.moderatorPdfBytes.get(regionId);

  if (pdfBytes?.length) {
    return new File([pdfBytes.slice()], fileName, { type: "application/pdf" });
  }

  const candidatePaths = Array.from(new Set(
    sources
      .map((source) => String(source?.projectPdfPath || "").trim())
      .filter(Boolean)
  ));

  for (const candidatePath of candidatePaths) {
    try {
      const response = await fetch(candidatePath, { cache: "no-store" });

      if (!response.ok) {
        continue;
      }

      const blob = await response.blob();

      if (!blob.size) {
        continue;
      }

      return new File([blob], getFileNameFromPath(candidatePath, fileName), {
        type: blob.type || "application/pdf"
      });
    } catch {
      // Try the next known path.
    }
  }

  return null;
}

async function writeModeratorDraftHistoryFiles(archiveHandle, draft, reason = "draft-save", options = {}) {
  const atlasId = draft.atlasId || getActiveAtlasId();
  const packageHandle = await getProjectPlatePackageHandle(archiveHandle, draft.regionId, atlasId);
  const payload = buildModeratorHistoryPayload(draft, reason, options);
  const payloadText = JSON.stringify(payload, null, 2);
  const timestampToken = buildTimestampToken();
  const snapshotFileName = `${timestampToken}-${String(reason || "draft-save").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.json`;

  if (
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PROJECT_ROOT ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ARCHIVE_PARENT ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ARCHIVE_ROOT ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_WORKSPACE
  ) {
    const historyHandle = await getArchiveSubdirectoryHandle(archiveHandle, [MODERATOR_PROJECT_HISTORY_FOLDER, atlasId, draft.regionId]);

    await writeArchiveTextFile(historyHandle, snapshotFileName, payloadText);
    await writeArchiveTextFile(historyHandle, "latest.json", payloadText);
  }

  await writeArchiveTextFile(packageHandle, "latest.json", payloadText);

  return {
    projectDraftPath: buildProjectDraftLatestPath(draft.regionId, atlasId),
    projectDraftSavedAt: new Date().toLocaleString()
  };
}

async function syncDraftToProjectArchive({
  draft,
  regionId,
  sessionFile,
  previewDataUrl = "",
  previewPage = 1,
  savePdfCopy = false,
  promptForHandle = false,
  reason = "draft-save",
  deleted = false
}) {
  const archiveHandle = await getProjectArchiveDirectoryHandle(promptForHandle);

  if (!archiveHandle) {
    return { draft, saved: false, skipped: true };
  }

  const nextDraft = { ...draft };
  const timestamp = new Date().toLocaleString();
  const atlasId = nextDraft.atlasId || getActiveAtlasId();
  const packageHandle = await getProjectPlatePackageHandle(archiveHandle, regionId, atlasId);

  if (savePdfCopy && sessionFile) {
    const fileName = buildProjectPdfFileName(
      nextDraft.projectPdfName || elements.moderatorProjectPdfName.value || sessionFile.name,
      regionId
    );

    await writeArchiveBlobFile(packageHandle, fileName, sessionFile);
    nextDraft.projectPdfName = fileName;
    nextDraft.projectPdfPath = buildProjectPdfPath(regionId, fileName, atlasId);
    nextDraft.projectPdfSavedAt = timestamp;
  }

  if (previewDataUrl) {
    const previewFileName = buildProjectPreviewFileName(regionId, previewPage);

    await writeArchiveBlobFile(packageHandle, previewFileName, await dataUrlToBlob(previewDataUrl));
    nextDraft.atlasPreviewPath = buildProjectPreviewPath(regionId, previewPage, atlasId);
    nextDraft.atlasPreviewSavedAt = timestamp;
    nextDraft.atlasPreviewImage = "";
  }

  const historyPaths = await writeModeratorDraftHistoryFiles(archiveHandle, nextDraft, reason, { deleted });
  nextDraft.projectDraftPath = historyPaths.projectDraftPath;
  nextDraft.projectDraftSavedAt = historyPaths.projectDraftSavedAt;

  return {
    draft: nextDraft,
    saved: true,
    skipped: false,
    archiveHandle
  };
}

async function writeProjectArchiveManifest(archiveHandle, draftMap) {
  if (
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER ||
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE
  ) {
    return false;
  }

  const manifestHandle = await archiveHandle.getFileHandle(MODERATOR_PROJECT_MANIFEST_FILE, { create: true });
  const writable = await manifestHandle.createWritable();
  await writable.write(JSON.stringify(buildProjectArchiveManifest(draftMap), null, 2));
  await writable.close();

  return true;
}

function extractDraftFromProjectArchivePayload(payload, atlasId = getActiveAtlasId()) {
  if (!payload || typeof payload !== "object" || payload.deleted) {
    return null;
  }

  const rawDraft = payload.plate && typeof payload.plate === "object" ? payload.plate : payload;

  if (!rawDraft || typeof rawDraft !== "object" || rawDraft.deleted) {
    return null;
  }

  return normalizeDraft(
    {
      ...rawDraft,
      atlasId: rawDraft.atlasId || payload.atlasId || atlasId
    },
    atlasId
  );
}

async function collectProjectArchiveLatestDrafts(packageRootHandle, atlasId = getActiveAtlasId()) {
  const drafts = [];

  if (!packageRootHandle?.entries) {
    return drafts;
  }

  try {
    for await (const [, plateHandle] of packageRootHandle.entries()) {
      if (plateHandle.kind !== "directory") {
        continue;
      }

      const payload = await readArchiveJsonFile(plateHandle, "latest.json");
      const draft = extractDraftFromProjectArchivePayload(payload, atlasId);

      if (draft) {
        drafts.push(draft);
      }
    }
  } catch {
    // A connected folder may be read-only or partially populated; keep any drafts already found.
  }

  return drafts;
}

async function loadProjectArchiveDrafts(atlasId = getActiveAtlasId()) {
  const archiveHandle = await getProjectArchiveDirectoryHandle(false);

  if (!archiveHandle) {
    return new Map();
  }

  const drafts = [];

  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE) {
    const draft = extractDraftFromProjectArchivePayload(await readArchiveJsonFile(archiveHandle, "latest.json"), atlasId);
    return buildDraftMap(draft ? [draft] : [], atlasId);
  }

  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER) {
    return buildDraftMap(await collectProjectArchiveLatestDrafts(archiveHandle, atlasId), atlasId);
  }

  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT) {
    try {
      const atlasHandle = await getExistingArchiveSubdirectoryHandle(archiveHandle, [atlasId]);
      return buildDraftMap(await collectProjectArchiveLatestDrafts(atlasHandle, atlasId), atlasId);
    } catch {
      return new Map();
    }
  }

  const manifest = await readArchiveJsonFile(archiveHandle, MODERATOR_PROJECT_MANIFEST_FILE);
  const manifestAtlasId = normalizeAtlasId(manifest?.atlasId || atlasId, atlasId || "atlas");

  if (manifestAtlasId === atlasId && Array.isArray(manifest?.drafts)) {
    drafts.push(
      ...manifest.drafts
        .map((draft) => extractDraftFromProjectArchivePayload({ ...draft, atlasId: draft.atlasId || manifest.atlasId || atlasId }, atlasId))
        .filter(Boolean)
    );
  }

  try {
    const atlasHandle = await getExistingArchiveSubdirectoryHandle(archiveHandle, [MODERATOR_PROJECT_PREVIEW_FOLDER, atlasId]);
    drafts.push(...await collectProjectArchiveLatestDrafts(atlasHandle, atlasId));
  } catch {
    // The archive can still be useful with only the manifest present.
  }

  return buildDraftMap(drafts, atlasId);
}

async function syncProjectArchiveDraftsFromHandle() {
  const archiveDrafts = await loadProjectArchiveDrafts(getActiveAtlasId());

  if (!archiveDrafts.size) {
    return false;
  }

  state.moderatorDrafts = mergeDraftMaps(state.moderatorDrafts, archiveDrafts);

  try {
    persistDrafts();
  } catch {
    // The connected archive remains the source of truth if browser storage is full.
  }

  syncModeratorViews();

  if (state.moderatorRegionId) {
    populateModeratorForm(state.moderatorRegionId);
  }

  return true;
}

function getRegionByIndex(index) {
  return REGIONS[index] || null;
}

function getDraft(regionId) {
  return state.moderatorDrafts.get(regionId) || null;
}

function getDraftRegionSnapshot(draft) {
  if (!draft) {
    return null;
  }

  const baseRegion = BASE_REGIONS[BASE_INDEX_BY_ID.get(draft.regionId)] || buildCustomPlateFromDraft(draft);

  if (!baseRegion) {
    return null;
  }

  const baseAtlasPreviewImage = baseRegion.atlasPreviewImage || "";
  const baseAtlasPreviewPath = baseRegion.atlasPreviewPath || "";
  const baseAtlasPreviewPage = baseRegion.atlasPreviewPage || 0;
  const baseProjectPdfName = baseRegion.projectPdfName || "";
  const baseProjectPdfPath = baseRegion.projectPdfPath || "";
  const baseProjectPdfSavedAt = baseRegion.projectPdfSavedAt || "";

  return {
    ...baseRegion,
    name: draft.name || baseRegion.name,
    uz: draft.uz || baseRegion.uz || "",
    type: draft.type || baseRegion.type || DEFAULT_PLATE_TYPE,
    scale: draft.scale || baseRegion.scale || DEFAULT_PLATE_SCALE,
    map: draft.atlasPreviewPath || baseAtlasPreviewPath || draft.atlasPreviewImage || baseAtlasPreviewImage || draft.map || baseRegion.map,
    caption: draft.caption || baseRegion.caption,
    summary: draft.summary || baseRegion.summary,
    moderatorNote: draft.moderatorNote || baseRegion.moderatorNote || "",
    sourcePdf: draft.sourcePdf || baseRegion.sourcePdf || "",
    sourceFileSize: draft.sourceFileSize || baseRegion.sourceFileSize || "",
    projectPdfName: draft.projectPdfName || baseProjectPdfName,
    projectPdfPath: draft.projectPdfPath || baseProjectPdfPath,
    projectPdfSavedAt: draft.projectPdfSavedAt || baseProjectPdfSavedAt,
    projectDraftPath: draft.projectDraftPath || baseRegion.projectDraftPath || "",
    projectDraftSavedAt: draft.projectDraftSavedAt || baseRegion.projectDraftSavedAt || "",
    atlasPreviewPath: draft.atlasPreviewPath || baseAtlasPreviewPath,
    atlasPreviewSavedAt: draft.atlasPreviewSavedAt || baseRegion.atlasPreviewSavedAt || "",
    atlasPreviewImage: draft.atlasPreviewImage || baseAtlasPreviewImage,
    atlasPreviewPage: draft.atlasPreviewPage || baseAtlasPreviewPage,
    isCustomPlate: Boolean(draft.isCustomPlate || baseRegion.isCustomPlate),
    customOrder: draft.customOrder ?? baseRegion.customOrder ?? 0,
    updatedAt: draft.updatedAt || baseRegion.updatedAt || "",
    hasModeratorDraft: true
  };
}

function getEffectiveRegion(regionOrId) {
  const baseRegion = typeof regionOrId === "string" ? REGIONS[INDEX_BY_ID.get(regionOrId)] : regionOrId;

  if (!baseRegion) {
    return null;
  }

  const draft = getDraft(baseRegion.id);
  if (!draft) {
    return {
      ...baseRegion,
      map: baseRegion.atlasPreviewPath || baseRegion.atlasPreviewImage || baseRegion.map,
      atlasPreviewPath: baseRegion.atlasPreviewPath || "",
      atlasPreviewSavedAt: baseRegion.atlasPreviewSavedAt || "",
      atlasPreviewImage: baseRegion.atlasPreviewImage || "",
      atlasPreviewPage: baseRegion.atlasPreviewPage || 0,
      projectPdfName: baseRegion.projectPdfName || "",
      projectPdfPath: baseRegion.projectPdfPath || "",
      projectPdfSavedAt: baseRegion.projectPdfSavedAt || "",
      projectDraftPath: baseRegion.projectDraftPath || "",
      projectDraftSavedAt: baseRegion.projectDraftSavedAt || ""
    };
  }

  return getDraftRegionSnapshot(draft);
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

  if (!REGIONS.length && sceneName !== "cover" && sceneName !== "contents" && sceneName !== "climateMaps" && sceneName !== "library") {
    sceneName = "cover";
  }

  elements.cover.hidden = sceneName !== "cover";
  elements.album.hidden = sceneName !== "album";
  elements.contents.hidden = sceneName !== "contents";
  elements.climateMaps.hidden = sceneName !== "climateMaps";
  elements.library.hidden = sceneName !== "library";
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

function syncLibraryAvailability() {
  const hasDocuments = SOURCE_DOCUMENTS.length > 0;
  const hasClimateMaps = getClimateMapDocuments().length > 0;

  if (elements.btnLibrary) {
    elements.btnLibrary.disabled = !hasDocuments;
  }

  if (elements.btnOpenLibrary) {
    elements.btnOpenLibrary.disabled = !hasDocuments;
  }

  if (elements.btnClimateMaps) {
    elements.btnClimateMaps.disabled = !hasClimateMaps;
  }

  if (elements.btnOpenClimateMaps) {
    elements.btnOpenClimateMaps.disabled = !hasClimateMaps;
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
  if (SOURCE_DOCUMENTS.length) {
    const reportCount = SOURCE_DOCUMENTS.filter((sourceDocument) => sourceDocument.category === "report").length;
    const mapCount = SOURCE_DOCUMENTS.filter((sourceDocument) => sourceDocument.category === "map").length;

    elements.metricPlates.textContent = String(SOURCE_DOCUMENTS.length);
    elements.metricRivers.textContent = String(reportCount);
    elements.metricSea.textContent = String(mapCount);

    if (elements.metricPlatesLabel) {
      elements.metricPlatesLabel.textContent = "Documents";
    }

    if (elements.metricRiversLabel) {
      elements.metricRiversLabel.textContent = "Reports";
    }

    if (elements.metricSeaLabel) {
      elements.metricSeaLabel.textContent = "Map PDFs";
    }
  } else {
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
  }

  if (elements.atlasCurrentName) {
    elements.atlasCurrentName.textContent = getActiveAtlasName();
  }

  if (elements.contentsSubtitle) {
    elements.contentsSubtitle.textContent = SOURCE_DOCUMENTS.length
      ? "Analytical reports and policy documents"
      : `Search plates in ${getActiveAtlasName()}`;
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

  if (
    state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER &&
    String(state.projectArchiveRootHandle?.name || "").trim().toLowerCase() !== String(nextAtlas.id || "").trim().toLowerCase()
  ) {
    state.projectArchiveRootHandle = null;
    state.projectArchiveConnectionMode = "";
  }

  if (elements.contentsSearch) {
    elements.contentsSearch.value = "";
  }

  if (elements.climateMapsSearch) {
    elements.climateMapsSearch.value = "";
    state.climateMapQuery = "";
  }

  closeDrawer();
  resetModeratorSessionCache();

  state.moderatorDrafts = mergeDraftMaps(
    buildDraftMap(MODERATOR_DRAFTS, nextAtlas.id),
    USE_BROWSER_DRAFTS ? loadStoredDrafts(nextAtlas.id) : new Map()
  );
  rebuildEffectiveRegionRegistry(state.moderatorDrafts);
  state.moderatorRegionId = REGIONS[0]?.id ?? "";

  populateAtlasOptions();
  updateOverview();
  populateModeratorRegionOptions();
  buildFilmstrip();
  buildContents();
  buildClimateMaps();
  buildModeratorDraftList();
  void syncProjectArchiveDraftsFromHandle().catch(() => {
    // Keep atlas switching responsive even if the connected archive cannot be read.
  });

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

function getModeratorProjectPackageTarget(regionId = state.moderatorRegionId || elements.moderatorRegion?.value || REGIONS[0]?.id || "plate") {
  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE) {
    return `${state.projectArchiveRootHandle?.name || regionId}/`;
  }

  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER) {
    return `${regionId}/`;
  }

  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT) {
    return `${getActiveAtlasId()}/${regionId}/`;
  }

  if (state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_WORKSPACE) {
    return `${MODERATOR_PROJECT_PREVIEW_FOLDER}/${getActiveAtlasId()}/${regionId}/`;
  }

  return `${buildProjectPlatePackagePath(regionId, getActiveAtlasId())}/`;
}

function updateModeratorProjectRootMeta(regionId = state.moderatorRegionId || elements.moderatorRegion?.value || REGIONS[0]?.id || "") {
  if (!elements.moderatorProjectRootMeta) {
    return;
  }

  const packageTarget = getModeratorProjectPackageTarget(regionId);
  const isAtlasFolderConnection = state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER;

  if (elements.moderatorProjectRoot) {
    elements.moderatorProjectRoot.textContent = state.projectArchiveRootHandle
      ? "Change save folder"
      : "Connect save folder";
  }

  if (!state.projectArchiveRootHandle) {
    elements.moderatorProjectRootMeta.textContent = `No save folder connected yet. Connect the atlas repo root, archive folder, atlas-previews folder, current atlas folder, or a single plate package to save plate packages under ${packageTarget}`;
    return;
  }

  const modeLabels = {
    [PROJECT_ARCHIVE_CONNECTION_PROJECT_ROOT]: "project root",
    [PROJECT_ARCHIVE_CONNECTION_ARCHIVE_PARENT]: "archive parent",
    [PROJECT_ARCHIVE_CONNECTION_ARCHIVE_ROOT]: "moderator archive",
    [PROJECT_ARCHIVE_CONNECTION_WORKSPACE]: "project workspace",
    [PROJECT_ARCHIVE_CONNECTION_PREVIEWS_ROOT]: "atlas previews folder",
    [PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER]: "atlas save folder",
    [PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE]: "plate package"
  };
  const modeLabel = modeLabels[state.projectArchiveConnectionMode] || "save folder";

  elements.moderatorProjectRootMeta.textContent = isAtlasFolderConnection || state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_PLATE_PACKAGE
    ? `Connected ${modeLabel}: ${state.projectArchiveRootHandle.name}. Plate packages will be written directly under ${packageTarget}`
    : `Connected ${modeLabel}: ${state.projectArchiveRootHandle.name}. Plate packages will be written under ${packageTarget}`;
}

async function connectModeratorProjectRoot() {
  if (typeof window.showDirectoryPicker !== "function") {
    setModeratorStatus(
      "Project archiving needs a Chromium browser over local HTTP so the atlas can ask for write access to the project folder.",
      true
    );
    return;
  }

  try {
    const pickedHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    const pickedMode = await getProjectArchiveConnectionMode(pickedHandle);

    if (!pickedMode) {
      throw createProjectArchiveRootError();
    }

    state.projectArchiveRootHandle = pickedHandle;
    state.projectArchiveConnectionMode = pickedMode;
    await storeProjectArchiveRootHandle(pickedHandle);
    const syncedArchiveDrafts = await syncProjectArchiveDraftsFromHandle();
    updateModeratorProjectRootMeta(elements.moderatorRegion.value);
    setModeratorStatus(
      `Connected save folder ${pickedHandle.name}. Plate packages will be saved under ${getModeratorProjectPackageTarget(elements.moderatorRegion.value)}.${syncedArchiveDrafts ? " Live archive records were loaded." : ""}`
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      setModeratorStatus("Save folder selection was cancelled.", true);
      return;
    }

    state.projectArchiveRootHandle = null;
    state.projectArchiveConnectionMode = "";
    await storeProjectArchiveRootHandle(null);
    updateModeratorProjectRootMeta(elements.moderatorRegion.value);
    setModeratorStatus(error?.message || PROJECT_ARCHIVE_ROOT_ERROR_MESSAGE, true);
  }
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

  if (hasSavedAtlasPreview(region)) {
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

  if (region.projectDraftPath) {
    draftFacts.push({
      key: "focus",
      label: "Draft record",
      value: region.projectDraftPath
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

function loadRenderedMapSource(region, source, requestId, options = {}) {
  const sources = (Array.isArray(source) ? source : [source])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  const preserveReadyMap = Boolean(options.preserveReadyMap);

  if (!sources.length) {
    if (state.pendingMapId !== requestId) {
      return;
    }

    if (preserveReadyMap && state.mapReady) {
      return;
    }

    state.mapReady = false;
    elements.mapImage.hidden = true;
    elements.mapPlaceholder.hidden = false;
    elements.hint.classList.add("gone");
    return;
  }

  const trySource = (sourceIndex) => {
    const nextSource = sources[sourceIndex];

    if (!nextSource) {
      if (state.pendingMapId !== requestId) {
        return;
      }

      if (preserveReadyMap && state.mapReady) {
        return;
      }

      state.mapReady = false;
      elements.mapImage.hidden = true;
      elements.mapPlaceholder.hidden = false;
      elements.hint.classList.add("gone");
      return;
    }

    const preview = new Image();

    preview.onload = () => {
      if (state.pendingMapId !== requestId) {
        return;
      }

      state.mapReady = true;
      elements.mapImage.classList.remove("swap");
      elements.mapImage.src = nextSource;
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

      trySource(sourceIndex + 1);
    };

    preview.src = nextSource;
  };

  trySource(0);
}

function renderMap(region) {
  const requestId = `${region.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  state.pendingMapId = requestId;
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

  const hasPdfSource = Boolean(region.projectPdfPath || state.moderatorPdfBytes.get(region.id));
  const hasImageSource = Boolean(region.atlasPreviewImage || region.atlasPreviewPath || region.map);

  if (!hasImageSource && !hasPdfSource) {
    elements.hint.classList.add("gone");
    return;
  }

  if (hasPdfSource && PDFJS_LIB?.getDocument) {
    void resolveRegionAtlasPreviewImageSource(region)
      .then((previewImageSource) => {
        loadRenderedMapSource(region, [previewImageSource, getRegionAtlasFallbackImageSource(region)], requestId, {
          preserveReadyMap: true
        });
      })
      .catch(() => {
        loadRenderedMapSource(region, [getRegionAtlasFallbackImageSource(region)], requestId, {
          preserveReadyMap: true
        });
      });

    void renderRegionProjectPdfImage(region)
      .then((pdfImage) => {
        if (state.pendingMapId === requestId && !state.mapReady) {
          loadRenderedMapSource(region, [pdfImage], requestId, {
            preserveReadyMap: true
          });
        }
      })
      .catch(() => {
        // The saved JPG path remains the primary source; PDF rendering is only a fallback.
      });
    return;
  }

  void resolveRegionAtlasPreviewImageSource(region).then((imageSource) => {
    loadRenderedMapSource(region, [imageSource, getRegionAtlasFallbackImageSource(region)], requestId);
  });
}

function getRegionAtlasFallbackImageSource(region) {
  return String(region?.atlasPreviewImage || "").trim();
}

async function resolveRegionAtlasPreviewImageSource(region) {
  const archivedPreviewFile = await resolveRegionAtlasPreviewFile(region);

  if (archivedPreviewFile) {
    try {
      return await fileToDataUrl(archivedPreviewFile);
    } catch {
      // Fall through to the next available source.
    }
  }

  return String(region?.atlasPreviewPath || region?.map || "").trim();
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
    if (card.dataset.documentId) {
      card.classList.toggle("curcard", card.dataset.documentId === state.librarySelectedId);
      return;
    }

    const cardIndex = Number(card.dataset.index);
    card.classList.toggle("curcard", state.started && cardIndex === state.index);
  });
}

function syncClimateMapsHighlight() {
  if (!elements.climateMapsGrid) {
    return;
  }

  Array.from(elements.climateMapsGrid.querySelectorAll("[data-document-id]")).forEach((card) => {
    const documentId = card.dataset.documentId;
    card.classList.toggle("curcard", documentId === state.librarySelectedId);
    card.classList.toggle("has-note", hasLibraryNote(documentId));
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
  return `${count} report${count === 1 ? "" : "s"} visible`;
}

function syncContentsCardThumbnail(card, region) {
  const thumb = card.querySelector(".cthumb");
  const image = card.querySelector("img");

  if (!thumb || !image || !region) {
    return;
  }

  const setLoaded = () => {
    thumb.classList.add("has-image");
  };

  const setMissing = () => {
    thumb.classList.remove("has-image");
  };

  image.addEventListener("load", setLoaded);
  image.addEventListener("error", setMissing);

  if (image.complete && image.naturalWidth) {
    setLoaded();
  }

  void resolveRegionAtlasPreviewImageSource(region)
    .then((imageSource) => {
      const nextSource = String(imageSource || getRegionAtlasFallbackImageSource(region) || "").trim();

      if (!nextSource || image.src === nextSource) {
        return;
      }

      setMissing();
      image.src = nextSource;
    })
    .catch(() => {
      if (!image.complete || !image.naturalWidth) {
        setMissing();
      }
    });
}

function getReportDocuments() {
  return SOURCE_DOCUMENTS.filter((sourceDocument) => sourceDocument.category === "report");
}

function getSourceDocumentSearchText(sourceDocument) {
  return [
    sourceDocument.title,
    sourceDocument.alias,
    sourceDocument.fileName,
    sourceDocument.folder,
    sourceDocument.categoryLabel,
    sourceDocument.collection,
    sourceDocument.year,
    sourceDocument.partner,
    sourceDocument.path,
    getLibrarySearchableNotes(sourceDocument.id),
    ...(sourceDocument.topics || []),
    ...(sourceDocument.keywords || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getVisibleReportDocuments() {
  const query = state.query.trim().toLowerCase();
  const reports = getReportDocuments();

  if (!query) {
    return reports;
  }

  return reports.filter((sourceDocument) => {
    return getSourceDocumentSearchText(sourceDocument).includes(query);
  });
}

function hasClimateMapKeyword(sourceDocument) {
  const haystack = getSourceDocumentSearchText(sourceDocument);
  return CLIMATE_MAP_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function hasExcludedClimateMapKeyword(sourceDocument) {
  const title = String(sourceDocument.title || "").toLowerCase();
  return CLIMATE_MAP_EXCLUDED_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(title));
}

function isClimateMapDocument(sourceDocument) {
  if (sourceDocument.category !== "map") {
    return false;
  }

  if (sourceDocument.collectionId === "regional-maps") {
    return false;
  }

  if (hasExcludedClimateMapKeyword(sourceDocument)) {
    return false;
  }

  return hasClimateMapKeyword(sourceDocument);
}

function getClimateMapDocuments() {
  return SOURCE_DOCUMENTS.filter(isClimateMapDocument);
}

function getVisibleClimateMapDocuments() {
  const query = state.climateMapQuery.trim().toLowerCase();
  const climateMaps = getClimateMapDocuments();

  if (!query) {
    return climateMaps;
  }

  return climateMaps.filter((sourceDocument) => getSourceDocumentSearchText(sourceDocument).includes(query));
}

function getClimateMapGroupLabel(collectionId) {
  const labels = {
    "thematic-maps": "Atlas thematic climate maps",
    "drivers-of-change": "Climate change and observed trends",
    "climate-chapter": "Climate chapter visuals"
  };

  return labels[collectionId] || "Climate map visuals";
}

function getClimateMapsCountLabel(count) {
  return `${count} climate map${count === 1 ? "" : "s"} visible`;
}

function renderClimateMapCard(sourceDocument, visibleIndex) {
  const currentClass = sourceDocument.id === state.librarySelectedId ? " curcard" : "";
  const metaParts = [
    sourceDocument.year,
    sourceDocument.sizeLabel
  ].filter(Boolean);
  const noteTag = hasLibraryNote(sourceDocument.id)
    ? '<div class="card-draft-tag">Notes saved</div>'
    : "";

  return `
    <button
      class="ccard report-card climate-map-card${currentClass}"
      type="button"
      data-document-id="${escapeHtml(sourceDocument.id)}"
      style="animation-delay:${Math.min(visibleIndex, 18) * 28}ms"
    >
      <div class="cthumb">
        <span class="cnum">MAP</span>
        <img alt="${escapeHtml(sourceDocument.title)} thumbnail" loading="lazy" />
        <div class="cthumb-fallback">
          <span>${escapeHtml(sourceDocument.collection)}</span>
          <strong>${escapeHtml(sourceDocument.title)}</strong>
        </div>
      </div>
      <div class="cmeta">
        <h4>${escapeHtml(sourceDocument.title)}</h4>
        <div class="ct">${escapeHtml(metaParts.join(" - ") || sourceDocument.collection)}</div>
        ${noteTag}
      </div>
    </button>
  `;
}

function buildClimateMaps() {
  if (!elements.climateMapsGrid) {
    return;
  }

  if (state.reportThumbnailObserver) {
    state.reportThumbnailObserver.disconnect();
    state.reportThumbnailObserver = null;
  }

  const allClimateMaps = getClimateMapDocuments();
  const visibleClimateMaps = getVisibleClimateMapDocuments();

  if (elements.climateMapsStats) {
    elements.climateMapsStats.textContent = `${allClimateMaps.length} climate map PDFs indexed`;
  }

  if (elements.climateMapsCount) {
    elements.climateMapsCount.textContent = getClimateMapsCountLabel(visibleClimateMaps.length);
  }

  if (!visibleClimateMaps.length) {
    elements.climateMapsGrid.innerHTML = `
      <div class="empty-contents">
        No climate maps match this filter. Try temperature, precipitation,
        water deficit, snow, solar, wind, or growing season.
      </div>
    `;
    return;
  }

  const groups = visibleClimateMaps.reduce((groupMap, sourceDocument) => {
    const key = sourceDocument.collectionId || "climate-map-visuals";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }

    groupMap.get(key).push(sourceDocument);
    return groupMap;
  }, new Map());

  let visibleIndex = 0;
  elements.climateMapsGrid.innerHTML = Array.from(groups.entries())
    .map(([collectionId, documents]) => {
      const cards = documents
        .map((sourceDocument) => renderClimateMapCard(sourceDocument, visibleIndex++))
        .join("");

      return `
        <section class="climate-map-group">
          <div class="climate-map-group-head">
            <h3>${escapeHtml(getClimateMapGroupLabel(collectionId))}</h3>
            <span>${documents.length} map${documents.length === 1 ? "" : "s"}</span>
          </div>
          <div class="cgrid climate-map-grid">
            ${cards}
          </div>
        </section>
      `;
    })
    .join("");

  Array.from(elements.climateMapsGrid.querySelectorAll("[data-document-id]")).forEach((card) => {
    if (!(card instanceof HTMLButtonElement)) {
      return;
    }

    card.addEventListener("click", () => {
      openLibraryDocument(card.dataset.documentId);
    });

    queueReportThumbnail(card, getLibraryDocumentById(card.dataset.documentId));
  });
}

async function renderSourceDocumentThumbnail(sourceDocument) {
  if (!sourceDocument || !PDFJS_LIB?.getDocument) {
    return "";
  }

  const loadingTask = PDFJS_LIB.getDocument({ url: resolveSourceDocumentUrl(sourceDocument.path) });

  try {
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(0.7, SOURCE_REPORT_THUMBNAIL_WIDTH / baseViewport.width);
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

    return canvas.toDataURL("image/jpeg", 0.78);
  } catch {
    return "";
  } finally {
    if (loadingTask.destroy) {
      loadingTask.destroy();
    }
  }
}

function applyReportThumbnail(card, thumbnailSource) {
  const thumb = card?.querySelector(".cthumb");
  const image = card?.querySelector("img");

  if (!thumb || !image || !thumbnailSource) {
    return;
  }

  image.addEventListener(
    "load",
    () => {
      thumb.classList.add("has-image");
    },
    { once: true }
  );
  image.src = thumbnailSource;
}

function requestReportThumbnail(card, sourceDocument) {
  if (!card || !sourceDocument) {
    return;
  }

  const cachedThumbnail = state.reportThumbnailCache.get(sourceDocument.id);
  if (cachedThumbnail) {
    applyReportThumbnail(card, cachedThumbnail);
    return;
  }

  let thumbnailPromise = state.reportThumbnailPromises.get(sourceDocument.id);
  if (!thumbnailPromise) {
    thumbnailPromise = renderSourceDocumentThumbnail(sourceDocument);
    state.reportThumbnailPromises.set(sourceDocument.id, thumbnailPromise);
  }

  void thumbnailPromise.then((thumbnailSource) => {
    state.reportThumbnailPromises.delete(sourceDocument.id);

    if (!thumbnailSource) {
      return;
    }

    state.reportThumbnailCache.set(sourceDocument.id, thumbnailSource);
    applyReportThumbnail(card, thumbnailSource);
  });
}

function queueReportThumbnail(card, sourceDocument) {
  if (!card || !sourceDocument) {
    return;
  }

  if (!PDFJS_LIB?.getDocument) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    requestReportThumbnail(card, sourceDocument);
    return;
  }

  if (!state.reportThumbnailObserver) {
    state.reportThumbnailObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          state.reportThumbnailObserver.unobserve(entry.target);
          requestReportThumbnail(entry.target, getLibraryDocumentById(entry.target.dataset.documentId));
        });
      },
      { root: null, rootMargin: "220px 0px", threshold: 0.01 }
    );
  }

  state.reportThumbnailObserver.observe(card);
}

function buildContents() {
  if (state.reportThumbnailObserver) {
    state.reportThumbnailObserver.disconnect();
    state.reportThumbnailObserver = null;
  }

  const visibleReports = getVisibleReportDocuments();
  elements.contentsCount.textContent = getContentsCountLabel(visibleReports.length);

  if (!visibleReports.length) {
    elements.contentsGrid.innerHTML = `
      <div class="empty-contents">
        No reports match this filter. Try broader terms such as climate, NDC,
        emissions, air quality, biodiversity, or adaptation.
      </div>
    `;
    return;
  }

  elements.contentsGrid.innerHTML = visibleReports
    .map((sourceDocument, visibleIndex) => {
      const currentClass = sourceDocument.id === state.librarySelectedId ? " curcard" : "";
      const metaParts = [
        sourceDocument.year,
        sourceDocument.partner,
        sourceDocument.sizeLabel
      ].filter(Boolean);
      const noteTag = hasLibraryNote(sourceDocument.id)
        ? '<div class="card-draft-tag">Notes saved</div>'
        : "";

      return `
        <button
          class="ccard report-card${currentClass}"
          type="button"
          data-document-id="${escapeHtml(sourceDocument.id)}"
          style="animation-delay:${Math.min(visibleIndex, 18) * 32}ms"
        >
          <div class="cthumb">
            <span class="cnum">${escapeHtml(sourceDocument.prefix ? `R ${sourceDocument.prefix}` : "REPORT")}</span>
            <img alt="${escapeHtml(sourceDocument.title)} thumbnail" loading="lazy" />
            <div class="cthumb-fallback">
              <span>PDF report</span>
              <strong>${escapeHtml(sourceDocument.title)}</strong>
            </div>
          </div>
          <div class="cmeta">
            <h4>${escapeHtml(sourceDocument.title)}</h4>
            ${sourceDocument.alias ? `<p class="report-alias">${escapeHtml(sourceDocument.alias)}</p>` : ""}
            <div class="ct">${escapeHtml(metaParts.join(" · ") || sourceDocument.collection)}</div>
            ${noteTag}
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
      openLibraryDocument(card.dataset.documentId);
    });

    queueReportThumbnail(card, getLibraryDocumentById(card.dataset.documentId));
  });
}

function getLibraryCountLabel(count) {
  return `${count} document${count === 1 ? "" : "s"} visible`;
}

function getLibraryCollectionOptions() {
  const options = [
    { id: "all", label: "All documents" },
    { id: "report", label: "Reports" },
    { id: "map", label: "Maps" }
  ];
  const seen = new Set(options.map((option) => option.id));

  SOURCE_DOCUMENTS.forEach((sourceDocument) => {
    if (!sourceDocument.collectionId || seen.has(sourceDocument.collectionId)) {
      return;
    }

    seen.add(sourceDocument.collectionId);
    options.push({
      id: sourceDocument.collectionId,
      label: sourceDocument.collection
    });
  });

  return options;
}

function populateLibraryCollectionOptions() {
  if (!elements.libraryCategory) {
    return;
  }

  elements.libraryCategory.innerHTML = getLibraryCollectionOptions()
    .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
    .join("");
  elements.libraryCategory.value = state.libraryCollection;
}

function getLibraryDocumentById(documentId) {
  return SOURCE_DOCUMENTS.find((sourceDocument) => sourceDocument.id === documentId) || null;
}

function getLibraryPageStorageKey(documentId, pageNumber) {
  return `${String(documentId || "").trim()}::${Math.max(1, Number(pageNumber) || 1)}`;
}

function getLibraryDocumentNote(documentId) {
  return String(state.libraryNotes?.documents?.[documentId] || "");
}

function getLibraryPageNote(documentId, pageNumber) {
  const normalizedPage = String(Math.max(1, Number(pageNumber) || 1));
  const pageNote = String(state.libraryNotes?.pages?.[documentId]?.[normalizedPage] || "").trim();

  if (pageNote) {
    return pageNote;
  }

  if (normalizedPage === "1") {
    return getLibraryDocumentNote(documentId).trim();
  }

  return "";
}

function getLibrarySearchableNotes(documentId) {
  const notes = [getLibraryDocumentNote(documentId)];
  const pageNotes = Object.values(state.libraryNotes?.pages?.[documentId] || {});

  return [...notes, ...pageNotes]
    .map((note) => String(note || "").trim())
    .filter(Boolean)
    .join(" ");
}

function hasLibraryNote(documentId) {
  return getLibrarySearchableNotes(documentId).trim().length > 0;
}

function hasCurrentLibraryPageNote(documentId = state.librarySelectedId, pageNumber = state.libraryPage) {
  return getLibraryPageNote(documentId, pageNumber).trim().length > 0;
}

function flushLibraryNoteSave() {
  if (!state.libraryNoteSaveTimer) {
    return;
  }

  window.clearTimeout(state.libraryNoteSaveTimer);
  state.libraryNoteSaveTimer = null;
  persistSelectedLibraryNote();
}

function getSelectedLibraryAiCacheEntry(documentId = state.librarySelectedId, pageNumber = state.libraryPage) {
  return state.libraryAiCache[getLibraryPageStorageKey(documentId, pageNumber)] || null;
}

function formatLibraryAiDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round((Number(milliseconds) || 0) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderLibraryAiTimer() {
  if (!elements.libraryAiTimer) {
    return;
  }

  const elapsedMs = state.libraryAiBusy && state.libraryAiStartedAt
    ? Date.now() - state.libraryAiStartedAt
    : state.libraryAiLastDurationMs;

  elements.libraryAiTimer.textContent = formatLibraryAiDuration(elapsedMs);
}

function startLibraryAiTimer() {
  if (state.libraryAiTimerId) {
    window.clearInterval(state.libraryAiTimerId);
  }

  state.libraryAiStartedAt = Date.now();
  state.libraryAiLastDurationMs = 0;
  renderLibraryAiTimer();
  state.libraryAiTimerId = window.setInterval(renderLibraryAiTimer, 1000);
}

function stopLibraryAiTimer(reset = false) {
  if (state.libraryAiTimerId) {
    window.clearInterval(state.libraryAiTimerId);
    state.libraryAiTimerId = null;
  }

  if (reset) {
    state.libraryAiLastDurationMs = 0;
  } else if (state.libraryAiStartedAt) {
    state.libraryAiLastDurationMs = Date.now() - state.libraryAiStartedAt;
  }

  state.libraryAiStartedAt = 0;
  renderLibraryAiTimer();
}

function setLibraryAiVisualState(visualState, chipLabel = "Standby") {
  if (elements.libraryAiPanel) {
    elements.libraryAiPanel.dataset.aiState = visualState;
  }

  if (elements.libraryAiChipLabel) {
    elements.libraryAiChipLabel.textContent = chipLabel;
  }
}

function getLibraryAiAvatarMood(sourceDocument, visualState, canExplain) {
  if (!sourceDocument) {
    return "idle";
  }

  if (!isLibraryAiDocument(sourceDocument)) {
    return "limited";
  }

  if (visualState === "loading") {
    return "loading";
  }

  if (visualState === "ready") {
    return "ready";
  }

  if (visualState === "error") {
    return "error";
  }

  return canExplain ? "active" : "waiting";
}

function getLibraryAiAvatarLines(mood) {
  switch (mood) {
    case "loading":
      return [
        "Scanning colors, legends, and labels now.",
        "Rolling through the page for climate clues.",
        "Checking patterns before I write the note."
      ];
    case "ready":
      return [
        "Fresh explanation delivered.",
        "You can copy this note or drop it into page notes.",
        "Regenerate if you want another pass on the same page."
      ];
    case "error":
      return [
        "I lost the route to the AI proxy.",
        "Once the local AI server is back, I can try again.",
        "The current page preview also needs to stay loaded."
      ];
    case "limited":
      return [
        "I am tuned for climate-related map pages right now.",
        "Pick a climate map and I will switch into interpreter mode.",
        "This MVP is still learning the rest of the library."
      ];
    case "waiting":
      return [
        "Load the page preview and I can start reading it.",
        "I need the current map image on screen before I explain it.",
        "Once the page renders, the Explain page button will wake up."
      ];
    case "active":
      return [
        "Ready for a climate map reading.",
        "Ask for an explanation and I will turn this page into plain English.",
        "I can compare labels, gradients, and layout on the current page."
      ];
    default:
      return [
        "Pick a climate map and I will translate it into plain English.",
        "I stay parked here until a map page needs decoding.",
        "Open a climate page and I will help interpret it."
      ];
  }
}

function syncLibraryAiAvatar(sourceDocument, visualState, canExplain) {
  if (!elements.libraryAiAvatar || !elements.libraryAiAvatarLine) {
    return;
  }

  const mood = getLibraryAiAvatarMood(sourceDocument, visualState, canExplain);
  const lines = getLibraryAiAvatarLines(mood);

  if (state.libraryAiAvatarMood !== mood) {
    state.libraryAiAvatarMood = mood;
    state.libraryAiAvatarTipIndex = 0;
  }

  elements.libraryAiAvatar.dataset.avatarMood = mood;
  elements.libraryAiAvatarLine.textContent = lines[Math.min(state.libraryAiAvatarTipIndex, lines.length - 1)] || "";
}

function nudgeLibraryAiAvatar() {
  if (!elements.libraryAiAvatar || !elements.libraryAiAvatarLine) {
    return;
  }

  const sourceDocument = getLibraryDocumentById(state.librarySelectedId);
  const visualState = elements.libraryAiPanel?.dataset.aiState || "idle";
  const canExplain = canExplainSelectedLibraryPage(sourceDocument);
  const mood = getLibraryAiAvatarMood(sourceDocument, visualState, canExplain);
  const lines = getLibraryAiAvatarLines(mood);

  if (state.libraryAiAvatarMood !== mood) {
    state.libraryAiAvatarMood = mood;
    state.libraryAiAvatarTipIndex = 0;
  } else {
    state.libraryAiAvatarTipIndex = (state.libraryAiAvatarTipIndex + 1) % lines.length;
  }

  elements.libraryAiAvatar.dataset.avatarMood = mood;
  elements.libraryAiAvatarLine.textContent = lines[state.libraryAiAvatarTipIndex] || "";
  elements.libraryAiAvatar.dataset.avatarReaction = "wave";

  if (state.libraryAiAvatarReactionTimer) {
    window.clearTimeout(state.libraryAiAvatarReactionTimer);
  }

  state.libraryAiAvatarReactionTimer = window.setTimeout(() => {
    if (elements.libraryAiAvatar) {
      delete elements.libraryAiAvatar.dataset.avatarReaction;
    }
    state.libraryAiAvatarReactionTimer = null;
  }, 1800);
}

function getDefaultLibraryAiPlaceholder() {
  return "The explanation uses the current PDF page image together with extracted page text. It stays separate from your notes until you insert it.";
}

function setLibraryAiStatus(message, isAlert = false) {
  if (!elements.libraryAiStatus) {
    return;
  }

  elements.libraryAiStatus.textContent = message;
  elements.libraryAiStatus.classList.toggle("is-alert", Boolean(isAlert));
}

function setLibraryAiText(text, placeholderMessage = getDefaultLibraryAiPlaceholder()) {
  if (!elements.libraryAiText || !elements.libraryAiPlaceholder) {
    return;
  }

  const hasText = Boolean(String(text || "").trim());
  elements.libraryAiText.hidden = !hasText;
  elements.libraryAiText.textContent = hasText ? String(text).trim() : "";
  elements.libraryAiPlaceholder.textContent = placeholderMessage;
  elements.libraryAiPlaceholder.hidden = hasText;
}

function isLibraryAiDocument(sourceDocument) {
  return Boolean(sourceDocument && isClimateMapDocument(sourceDocument));
}

function canExplainSelectedLibraryPage(sourceDocument = getLibraryDocumentById(state.librarySelectedId)) {
  return Boolean(
    isLibraryAiDocument(sourceDocument) &&
      state.libraryPdfDocument &&
      elements.libraryCanvas?.width &&
      elements.libraryCanvas?.height
  );
}

function abortLibraryAiRequest() {
  if (state.libraryAiAbortController) {
    state.libraryAiAbortController.abort();
  }

  state.libraryAiAbortController = null;
  state.libraryAiBusy = false;
  stopLibraryAiTimer(true);
}

function syncLibraryAiPanel(statusMessage = "", isAlert = false) {
  const sourceDocument = getLibraryDocumentById(state.librarySelectedId);
  const cacheEntry = getSelectedLibraryAiCacheEntry();
  const canExplain = canExplainSelectedLibraryPage(sourceDocument);
  const hasCachedExplanation = Boolean(cacheEntry?.text);
  let visualState = "idle";
  let chipLabel = "Standby";
  let placeholderMessage = getDefaultLibraryAiPlaceholder();

  if (elements.libraryAiExplainLabel) {
    elements.libraryAiExplainLabel.textContent = state.libraryAiBusy
      ? "Explaining..."
      : hasCachedExplanation
        ? "Regenerate"
        : "Explain page";
  }

  if (elements.libraryAiExplain) {
    elements.libraryAiExplain.disabled = state.libraryAiBusy || !canExplain;
  }

  if (elements.libraryAiCopy) {
    elements.libraryAiCopy.disabled = state.libraryAiBusy || !hasCachedExplanation;
  }

  if (state.libraryAiBusy) {
    visualState = "loading";
    chipLabel = "Reviewing";
    placeholderMessage = "Reviewing the current map page. Reading visible labels, gradients, legends, and spatial patterns before writing the note.";
  } else if (isAlert) {
    visualState = "error";
    chipLabel = "Check setup";
    placeholderMessage = "The AI review could not complete. Confirm the local AI proxy is running and that the current page preview is loaded.";
  } else if (!sourceDocument) {
    visualState = "idle";
    chipLabel = "Standby";
    placeholderMessage = getDefaultLibraryAiPlaceholder();
  } else if (!isLibraryAiDocument(sourceDocument)) {
    visualState = "idle";
    chipLabel = "Climate only";
    placeholderMessage = "This MVP AI review is currently focused on climate-related map pages in the library viewer.";
  } else if (hasCachedExplanation) {
    visualState = "ready";
    chipLabel = "Ready";
  } else if (!canExplain) {
    visualState = "idle";
    chipLabel = "Waiting";
    placeholderMessage = "Load the current PDF page preview to enable AI review for this map page.";
  }

  setLibraryAiVisualState(visualState, chipLabel);
  syncLibraryAiAvatar(sourceDocument, visualState, canExplain);
  setLibraryAiText(cacheEntry?.text || "", placeholderMessage);

  if (statusMessage) {
    setLibraryAiStatus(statusMessage, isAlert);
    return;
  }

  if (!sourceDocument) {
    setLibraryAiStatus("Select a document to preview before requesting an explanation.");
    return;
  }

  if (!isLibraryAiDocument(sourceDocument)) {
    setLibraryAiStatus("The MVP AI interpreter is currently enabled for climate-related map pages.");
    return;
  }

  if (state.libraryAiBusy) {
    setLibraryAiStatus("Analyzing the current page image and extracted labels...");
    return;
  }

  if (hasCachedExplanation) {
    setLibraryAiStatus(`English explanation ready for page ${state.libraryPage}.`);
    return;
  }

  if (!canExplain) {
    setLibraryAiStatus("Load the current page preview to generate an English explanation.");
    return;
  }

  setLibraryAiStatus(`Explain page ${state.libraryPage} to generate a short English note.`);
}

function syncSelectedLibraryNoteField(sourceDocument = getLibraryDocumentById(state.librarySelectedId)) {
  if (!elements.libraryNote) {
    return;
  }

  if (!sourceDocument) {
    elements.libraryNote.value = "";
    elements.libraryNoteStatus.textContent = "";
    elements.libraryNoteStatus.classList.remove("is-alert");
    return;
  }

  elements.libraryNote.value = getLibraryPageNote(sourceDocument.id, state.libraryPage);
  elements.libraryNoteStatus.textContent = hasCurrentLibraryPageNote(sourceDocument.id, state.libraryPage)
    ? `Page ${state.libraryPage} notes saved.`
    : "";
  elements.libraryNoteStatus.classList.remove("is-alert");
}

function getLibraryPageText(documentId, pageNumber) {
  return state.libraryPageTextCache.get(getLibraryPageStorageKey(documentId, pageNumber)) || "";
}

async function extractLibraryPageText(pdfPage) {
  try {
    const textContent = await pdfPage.getTextContent();

    return (textContent?.items || [])
      .map((item) => String(item?.str || "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function captureLibraryCanvasImage() {
  const sourceCanvas = elements.libraryCanvas;

  if (!sourceCanvas?.width || !sourceCanvas?.height) {
    return "";
  }

  const longestSide = Math.max(sourceCanvas.width, sourceCanvas.height);
  const scale = Math.min(1, LIBRARY_AI_IMAGE_MAX_DIMENSION / Math.max(1, longestSide));
  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = Math.max(1, Math.floor(sourceCanvas.width * scale));
  targetCanvas.height = Math.max(1, Math.floor(sourceCanvas.height * scale));

  const context = targetCanvas.getContext("2d", { alpha: false });
  if (!context) {
    return "";
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  context.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);

  return targetCanvas.toDataURL("image/jpeg", LIBRARY_AI_IMAGE_QUALITY);
}

function resolveLibraryAiEndpoint() {
  const configuredEndpoint = String(ATLAS_CONFIG.aiEndpoint || "").trim();

  if (configuredEndpoint) {
    return configuredEndpoint;
  }

  if (/^https?:$/i.test(window.location.protocol)) {
    return new URL("/api/explain-page", window.location.origin).href;
  }

  return `${LIBRARY_AI_DEFAULT_PROXY_ORIGIN}/api/explain-page`;
}

async function explainSelectedLibraryPage() {
  const sourceDocument = getLibraryDocumentById(state.librarySelectedId);

  if (!sourceDocument) {
    syncLibraryAiPanel("Select a document to preview before requesting an explanation.", true);
    return;
  }

  if (!isLibraryAiDocument(sourceDocument)) {
    syncLibraryAiPanel("The MVP AI interpreter is currently limited to climate-related map pages.", true);
    return;
  }

  if (!canExplainSelectedLibraryPage(sourceDocument)) {
    syncLibraryAiPanel("Wait for the current page preview to finish rendering, then try again.", true);
    return;
  }

  const pageNumber = state.libraryPage;
  const imageDataUrl = captureLibraryCanvasImage();
  if (!imageDataUrl) {
    syncLibraryAiPanel("The current page image could not be captured for AI analysis.", true);
    return;
  }

  abortLibraryAiRequest();
  const requestToken = ++state.libraryAiRequestToken;
  const abortController = new AbortController();
  let finalStatusMessage = "";
  let finalStatusAlert = false;
  state.libraryAiAbortController = abortController;
  state.libraryAiBusy = true;
  startLibraryAiTimer();
  syncLibraryAiPanel();

  try {
    const response = await fetch(resolveLibraryAiEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        documentId: sourceDocument.id,
        title: sourceDocument.title,
        alias: sourceDocument.alias,
        fileName: sourceDocument.fileName,
        collection: sourceDocument.collection,
        collectionId: sourceDocument.collectionId,
        category: sourceDocument.category,
        topics: sourceDocument.topics,
        keywords: sourceDocument.keywords,
        pageNumber,
        pageCount: state.libraryPageCount,
        pageText: getLibraryPageText(sourceDocument.id, pageNumber),
        imageDataUrl
      }),
      signal: abortController.signal
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const routeHint =
        response.status === 404 || response.status === 501
          ? "AI endpoint not found. Start the atlas with `python tools/serve_atlas.py` or point window.ATLAS_CONFIG.aiEndpoint to the running AI proxy."
          : "";
      throw new Error(payload?.error || routeHint || `AI request failed with status ${response.status}.`);
    }

    const explanation = String(payload?.explanation || "").trim();
    if (!explanation) {
      throw new Error("The AI service returned an empty explanation.");
    }

    if (requestToken !== state.libraryAiRequestToken) {
      return;
    }

    state.libraryAiCache[getLibraryPageStorageKey(sourceDocument.id, pageNumber)] = {
      text: explanation,
      updatedAt: String(payload?.updatedAt || new Date().toISOString()),
      model: String(payload?.model || "").trim()
    };
    persistLibraryAiCache();
    finalStatusMessage = `English explanation generated for page ${pageNumber}.`;
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    finalStatusMessage = String(error?.message || "The AI explanation request failed.");
    finalStatusAlert = true;
  } finally {
    if (state.libraryAiAbortController === abortController) {
      state.libraryAiAbortController = null;
    }

    state.libraryAiBusy = false;
    if (requestToken === state.libraryAiRequestToken) {
      if (!abortController.signal.aborted) {
        stopLibraryAiTimer();
      }
      syncLibraryAiPanel(finalStatusMessage, finalStatusAlert);
    }
  }
}

function insertLibraryAiIntoNotes() {
  const cacheEntry = getSelectedLibraryAiCacheEntry();

  if (!cacheEntry?.text) {
    syncLibraryAiPanel("Generate an explanation before inserting it into page notes.", true);
    return;
  }

  const currentValue = String(elements.libraryNote.value || "").trim();
  const nextValue = currentValue
    ? currentValue.includes(cacheEntry.text)
      ? currentValue
      : `${currentValue}\n\n${cacheEntry.text}`
    : cacheEntry.text;

  window.clearTimeout(state.libraryNoteSaveTimer);
  state.libraryNoteSaveTimer = null;
  elements.libraryNote.value = nextValue;
  persistSelectedLibraryNote();
}

function getVisibleLibraryDocuments() {
  const query = state.libraryQuery.trim().toLowerCase();
  const collection = state.libraryCollection;

  return SOURCE_DOCUMENTS.filter((sourceDocument) => {
    const matchesCollection =
      collection === "all" ||
      sourceDocument.category === collection ||
      sourceDocument.collectionId === collection;

    if (!matchesCollection) {
      return false;
    }

    if (!query) {
      return true;
    }

    return getSourceDocumentSearchText(sourceDocument).includes(query);
  });
}

function buildLibraryList() {
  if (!elements.libraryList) {
    return;
  }

  const visibleDocuments = getVisibleLibraryDocuments();

  if (elements.libraryStats) {
    const reportCount = SOURCE_DOCUMENTS.filter((sourceDocument) => sourceDocument.category === "report").length;
    const mapCount = SOURCE_DOCUMENTS.filter((sourceDocument) => sourceDocument.category === "map").length;
    elements.libraryStats.textContent = `${SOURCE_DOCUMENTS.length} source PDFs indexed · ${reportCount} reports · ${mapCount} maps`;
  }

  elements.libraryCount.textContent = getLibraryCountLabel(visibleDocuments.length);

  if (!visibleDocuments.length) {
    elements.libraryList.innerHTML = `
      <div class="empty-contents">
        No source documents match this filter.
      </div>
    `;
    return;
  }

  if (state.librarySelectedId && !visibleDocuments.some((sourceDocument) => sourceDocument.id === state.librarySelectedId)) {
    state.librarySelectedId = "";
    renderLibraryDocument(null, { loadPdf: false });
  }

  elements.libraryList.innerHTML = visibleDocuments
    .map((sourceDocument, visibleIndex) => {
      const activeClass = sourceDocument.id === state.librarySelectedId ? " is-active" : "";
      const noteClass = hasLibraryNote(sourceDocument.id) ? " has-note" : "";
      const metaParts = [
        sourceDocument.categoryLabel,
        sourceDocument.year,
        sourceDocument.sizeLabel
      ].filter(Boolean);
      const topics = (sourceDocument.topics || []).slice(0, 3).join(" · ");

      return `
        <button
          class="library-card${activeClass}${noteClass}"
          type="button"
          data-document-id="${escapeHtml(sourceDocument.id)}"
          style="animation-delay:${Math.min(visibleIndex, 18) * 24}ms"
        >
          <div class="library-card-title">${escapeHtml(sourceDocument.title)}</div>
          ${sourceDocument.alias ? `<div class="library-card-alias">${escapeHtml(sourceDocument.alias)}</div>` : ""}
          <div class="library-card-meta">${metaParts.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</div>
          <div class="library-card-topic">${escapeHtml(topics || sourceDocument.collection)}</div>
        </button>
      `;
    })
    .join("");

  Array.from(elements.libraryList.querySelectorAll("[data-document-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      selectLibraryDocument(button.dataset.documentId);
    });
  });
}

function syncLibraryListHighlight() {
  if (!elements.libraryList) {
    return;
  }

  Array.from(elements.libraryList.querySelectorAll("[data-document-id]")).forEach((card) => {
    const documentId = card.dataset.documentId;
    card.classList.toggle("is-active", documentId === state.librarySelectedId);
    card.classList.toggle("has-note", hasLibraryNote(documentId));
  });
}

function resolveSourceDocumentPath(path) {
  const rawPath = String(path || "").trim();

  if (!rawPath || /^(?:data:|blob:|https?:|file:)/i.test(rawPath)) {
    return rawPath;
  }

  const isBuiltFromDist = /\/dist(?:\/|$)/.test(window.location.pathname);
  if (isBuiltFromDist && rawPath.startsWith("assets/")) {
    return `../${rawPath}`;
  }

  return rawPath;
}

function resolveSourceDocumentUrl(path) {
  const resolvedPath = resolveSourceDocumentPath(path);

  try {
    return new URL(resolvedPath, window.location.href).href;
  } catch {
    return resolvedPath;
  }
}

function cancelLibraryRenderTask() {
  if (state.libraryRenderTask?.cancel) {
    try {
      state.libraryRenderTask.cancel();
    } catch {
      // PDF.js may already have completed the task.
    }
  }

  state.libraryRenderTask = null;
}

function clearLibraryPdfDocument() {
  cancelLibraryRenderTask();

  if (state.libraryPdfLoadingTask?.destroy) {
    try {
      state.libraryPdfLoadingTask.destroy();
    } catch {
      // A pending worker cleanup should not block the UI reset.
    }
  }

  state.libraryPdfDocumentId = "";
  state.libraryPdfLoadingTask = null;
  state.libraryPdfDocument = null;
  state.libraryPage = 1;
  state.libraryPageCount = 0;
}

function resetLibraryPdfCanvas() {
  cancelLibraryRenderTask();
  state.libraryRenderToken += 1;

  if (elements.libraryCanvas) {
    const context = elements.libraryCanvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, elements.libraryCanvas.width, elements.libraryCanvas.height);
    }

    elements.libraryCanvas.width = 0;
    elements.libraryCanvas.height = 0;
    elements.libraryCanvas.style.width = "0";
    elements.libraryCanvas.style.height = "0";
  }

  if (elements.libraryCanvasShell) {
    elements.libraryCanvasShell.hidden = true;
  }
}

function setLibraryPdfMessage(message, isAlert = false) {
  if (!elements.libraryPdfEmpty) {
    return;
  }

  elements.libraryPdfEmpty.hidden = false;
  elements.libraryPdfEmpty.textContent = message;
  elements.libraryPdfEmpty.classList.toggle("is-alert", Boolean(isAlert));
}

function updateLibraryPdfControls() {
  if (!elements.libraryPage) {
    return;
  }

  const hasDocument = Boolean(state.libraryPdfDocument);
  elements.libraryPage.textContent = hasDocument
    ? `Page ${state.libraryPage} of ${state.libraryPageCount} · ${Math.round(state.libraryZoom * 100)}%`
    : "Page -- of --";
  elements.libraryPrev.disabled = !hasDocument || state.libraryPage <= 1;
  elements.libraryNext.disabled = !hasDocument || state.libraryPage >= state.libraryPageCount;
  elements.libraryZoomOut.disabled = !hasDocument || state.libraryZoom <= SOURCE_LIBRARY_MIN_ZOOM;
  elements.libraryZoomIn.disabled = !hasDocument || state.libraryZoom >= SOURCE_LIBRARY_MAX_ZOOM;
  elements.libraryZoomFit.disabled = !hasDocument || state.libraryZoom === 1;
  syncLibraryAiPanel();
}

async function ensureLibraryPdfDocument(sourceDocument) {
  if (!sourceDocument) {
    return null;
  }

  if (state.libraryPdfDocumentId === sourceDocument.id && state.libraryPdfDocument) {
    return state.libraryPdfDocument;
  }

  clearLibraryPdfDocument();

  if (!PDFJS_LIB?.getDocument) {
    setLibraryPdfMessage("PDF preview is unavailable until the local PDF.js dependency is installed.", true);
    updateLibraryPdfControls();
    return null;
  }

  const loadingTask = PDFJS_LIB.getDocument({ url: resolveSourceDocumentUrl(sourceDocument.path) });
  state.libraryPdfDocumentId = sourceDocument.id;
  state.libraryPdfLoadingTask = loadingTask;

  const pdfDocument = await loadingTask.promise;
  if (state.libraryPdfLoadingTask !== loadingTask || state.librarySelectedId !== sourceDocument.id) {
    if (pdfDocument?.destroy) {
      pdfDocument.destroy();
    }
    return null;
  }

  state.libraryPdfDocument = pdfDocument;
  state.libraryPageCount = pdfDocument.numPages || 1;
  state.libraryPage = Math.max(1, Math.min(state.libraryPage, state.libraryPageCount));
  return pdfDocument;
}

async function renderLibraryPdfPage(requestedPage = state.libraryPage) {
  const sourceDocument = getLibraryDocumentById(state.librarySelectedId);

  if (!sourceDocument) {
    resetLibraryPdfCanvas();
    setLibraryPdfMessage("Select a document to preview.");
    updateLibraryPdfControls();
    return;
  }

  resetLibraryPdfCanvas();
  const renderToken = ++state.libraryRenderToken;
  setLibraryPdfMessage(`Loading ${sourceDocument.fileName || sourceDocument.title}...`);
  updateLibraryPdfControls();

  try {
    const pdfDocument = await ensureLibraryPdfDocument(sourceDocument);
    if (!pdfDocument || renderToken !== state.libraryRenderToken) {
      return;
    }

    const pageNumber = Math.max(1, Math.min(requestedPage, pdfDocument.numPages || 1));
    const page = await pdfDocument.getPage(pageNumber);
    if (renderToken !== state.libraryRenderToken) {
      return;
    }

    const pageTextPromise = extractLibraryPageText(page);

    const baseViewport = page.getViewport({ scale: 1 });
    const stageWidth = Math.max(320, (elements.libraryPdfStage?.clientWidth || 720) - 56);
    const fitScale = Math.min(SOURCE_LIBRARY_PREVIEW_MAX_SCALE, stageWidth / baseViewport.width);
    const scale = Math.max(0.2, Math.min(SOURCE_LIBRARY_PREVIEW_MAX_SCALE, fitScale * state.libraryZoom));
    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    const canvas = elements.libraryCanvas;
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    state.libraryRenderTask = page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
    });

    await state.libraryRenderTask.promise;
    state.libraryRenderTask = null;

    const pageText = await pageTextPromise;

    if (renderToken !== state.libraryRenderToken) {
      return;
    }

    state.libraryPageTextCache.set(getLibraryPageStorageKey(sourceDocument.id, pageNumber), pageText);
    state.libraryPage = pageNumber;
    state.libraryPageCount = pdfDocument.numPages || 1;
    elements.libraryPdfEmpty.hidden = true;
    elements.libraryCanvasShell.hidden = false;
    syncSelectedLibraryNoteField(sourceDocument);
    updateLibraryPdfControls();
  } catch (error) {
    if (error?.name === "RenderingCancelledException") {
      return;
    }

    if (renderToken !== state.libraryRenderToken) {
      return;
    }

    resetLibraryPdfCanvas();
    setLibraryPdfMessage(`Could not preview ${sourceDocument.fileName || sourceDocument.title}. Use Open PDF to view the source file.`, true);
    updateLibraryPdfControls();
  }
}

function renderLibraryDocument(sourceDocument, options = {}) {
  const loadPdf = options.loadPdf !== false;

  if (!sourceDocument) {
    abortLibraryAiRequest();
    state.librarySelectedId = "";
    elements.libraryDocKicker.textContent = "Source PDF";
    elements.libraryDocTitle.textContent = "Select a document";
    elements.libraryDocMeta.innerHTML = "";
    elements.libraryOpenPdf.href = "#";
    elements.libraryOpenPdf.setAttribute("aria-disabled", "true");
    syncSelectedLibraryNoteField(null);
    clearLibraryPdfDocument();
    resetLibraryPdfCanvas();
    setLibraryPdfMessage("Select a document to preview.");
    updateLibraryPdfControls();
    syncLibraryAiPanel();
    syncLibraryListHighlight();
    return;
  }

  abortLibraryAiRequest();
  state.librarySelectedId = sourceDocument.id;
  state.libraryPage = 1;
  state.libraryZoom = 1;

  elements.libraryDocKicker.textContent = `${sourceDocument.categoryLabel} · ${sourceDocument.collection}`;
  elements.libraryDocTitle.textContent = sourceDocument.title;
  elements.libraryDocMeta.innerHTML = [
    sourceDocument.alias,
    sourceDocument.year,
    sourceDocument.partner,
    sourceDocument.sizeLabel,
    sourceDocument.folder
  ]
    .filter(Boolean)
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");

  const documentPath = resolveSourceDocumentPath(sourceDocument.path);
  elements.libraryOpenPdf.href = documentPath || "#";
  elements.libraryOpenPdf.toggleAttribute("aria-disabled", !documentPath);
  syncSelectedLibraryNoteField(sourceDocument);
  syncLibraryListHighlight();
  syncContentsHighlight();
  syncClimateMapsHighlight();
  clearLibraryPdfDocument();
  syncLibraryAiPanel();

  if (loadPdf) {
    void renderLibraryPdfPage(1);
  } else {
    resetLibraryPdfCanvas();
    setLibraryPdfMessage("Select a document to preview.");
    updateLibraryPdfControls();
    syncLibraryAiPanel();
  }
}

function selectLibraryDocument(documentId) {
  flushLibraryNoteSave();
  const sourceDocument = getLibraryDocumentById(documentId);

  if (!sourceDocument) {
    return;
  }

  renderLibraryDocument(sourceDocument, { loadPdf: state.currentScene === "library" });
}

function persistSelectedLibraryNote() {
  const sourceDocument = getLibraryDocumentById(state.librarySelectedId);

  if (!sourceDocument) {
    return;
  }

  const note = elements.libraryNote.value.trim();
  const pageNumber = String(Math.max(1, Number(state.libraryPage) || 1));

  state.libraryNotes.pages[sourceDocument.id] = state.libraryNotes.pages[sourceDocument.id] || {};

  if (note) {
    state.libraryNotes.pages[sourceDocument.id][pageNumber] = note;
  } else {
    delete state.libraryNotes.pages[sourceDocument.id][pageNumber];

    if (!Object.keys(state.libraryNotes.pages[sourceDocument.id]).length) {
      delete state.libraryNotes.pages[sourceDocument.id];
    }
  }

  persistSourceLibraryNotes();
  elements.libraryNoteStatus.textContent = note ? `Page ${pageNumber} notes saved.` : "";
  elements.libraryNoteStatus.classList.remove("is-alert");
  state.libraryNoteSaveTimer = null;
  syncLibraryListHighlight();
  syncContentsHighlight();
  syncClimateMapsHighlight();
}

function getDefaultDraftValues(regionId) {
  const region = getEffectiveRegion(regionId);
  const draft = getDraft(regionId);

  return {
    regionId,
    isCustomPlate: Boolean(draft?.isCustomPlate || region?.isCustomPlate),
    name: draft?.name || region?.name || "",
    uz: draft?.uz || region?.uz || "",
    type: draft?.type || region?.type || DEFAULT_PLATE_TYPE,
    scale: draft?.scale || region?.scale || DEFAULT_PLATE_SCALE,
    map: draft?.map || region?.map || `assets/maps/${regionId}.jpg`,
    caption: region?.caption || "",
    summary: region?.summary || "",
    moderatorNote: draft?.moderatorNote || "",
    sourcePdf: draft?.sourcePdf || "",
    sourceFileSize: draft?.sourceFileSize || "",
    projectPdfName: draft?.projectPdfName || region?.projectPdfName || "",
    projectPdfPath: draft?.projectPdfPath || region?.projectPdfPath || "",
    projectDraftPath: draft?.projectDraftPath || region?.projectDraftPath || "",
    atlasPreviewPath: draft?.atlasPreviewPath || region?.atlasPreviewPath || ""
  };
}

function getNextCustomPlateOrder() {
  return Array.from(state.moderatorDrafts.values()).reduce((maxOrder, draft) => {
    if (!draft?.isCustomPlate) {
      return maxOrder;
    }

    return Math.max(maxOrder, Number(draft.customOrder) || 0);
  }, -1) + 1;
}

function buildUniqueCustomPlateId(seed = "custom-plate") {
  const baseSlug = slugifyProjectPdfName(seed) || "custom-plate";
  let counter = 1;
  let candidate = baseSlug;

  while (INDEX_BY_ID.has(candidate) || state.moderatorDrafts.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function createCustomModeratorPlate() {
  const customOrder = getNextCustomPlateOrder();
  const regionId = buildUniqueCustomPlateId(`plate-${REGIONS.length + 1}`);
  const draft = normalizeDraft(
    {
      atlasId: getActiveAtlasId(),
      regionId,
      isCustomPlate: true,
      customOrder,
      name: `New plate ${customOrder + 1}`,
      uz: "",
      type: DEFAULT_PLATE_TYPE,
      scale: DEFAULT_PLATE_SCALE,
      map: `assets/maps/${regionId}.jpg`,
      caption: "New atlas plate draft awaiting title and map export.",
      summary: "Add a description, source PDF, and atlas preview for this new plate.",
      updatedAt: new Date().toLocaleString()
    },
    getActiveAtlasId()
  );

  if (!draft) {
    return;
  }

  state.moderatorDrafts.set(regionId, draft);
  persistDrafts();
  syncModeratorViews();
  populateModeratorForm(regionId);
  setModeratorStatus(`Added ${draft.name} to ${getActiveAtlasName()}. Fill in the details, then save the draft.`);
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
  return renderPdfDocumentPageToJpegDataUrl(pdfDocument, requestedPage);
}

async function renderPdfDocumentPageToJpegDataUrl(pdfDocument, requestedPage = 1) {
  if (!pdfDocument) {
    return "";
  }

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

async function renderProjectAtlasPdfImage(projectPdfPath, requestedPage = 1) {
  if (!projectPdfPath || !PDFJS_LIB?.getDocument) {
    return "";
  }

  const loadingTask = PDFJS_LIB.getDocument({ url: projectPdfPath });

  try {
    const pdfDocument = await loadingTask.promise;
    return renderPdfDocumentPageToJpegDataUrl(pdfDocument, requestedPage);
  } catch {
    return "";
  } finally {
    if (loadingTask.destroy) {
      loadingTask.destroy();
    }
  }
}

async function renderPdfBytesToAtlasImage(pdfBytes, requestedPage = 1) {
  if (!pdfBytes?.length || !PDFJS_LIB?.getDocument) {
    return "";
  }

  const loadingTask = PDFJS_LIB.getDocument({ data: pdfBytes.slice() });

  try {
    const pdfDocument = await loadingTask.promise;
    return renderPdfDocumentPageToJpegDataUrl(pdfDocument, requestedPage);
  } catch {
    return "";
  } finally {
    if (loadingTask.destroy) {
      loadingTask.destroy();
    }
  }
}

function getRegionProjectPdfFileName(region) {
  return getFileNameFromPath(
    region?.projectPdfPath || "",
    buildProjectPdfFileName(region?.projectPdfName || region?.sourcePdf || region?.id || "region-source", region?.id || "region")
  );
}

function getRegionAtlasPreviewFileName(region) {
  return getFileNameFromPath(
    region?.atlasPreviewPath || "",
    buildProjectPreviewFileName(region?.id || "plate", region?.atlasPreviewPage || 1)
  );
}

async function resolveRegionAtlasPreviewFile(region) {
  if (!region?.id) {
    return null;
  }

  const archiveHandle = await getProjectArchiveDirectoryHandle(false);
  if (!archiveHandle) {
    return null;
  }

  try {
    const packageHandle = await getProjectPlatePackageHandle(archiveHandle, region.id, region.atlasId || getActiveAtlasId());
    const fileHandle = await packageHandle.getFileHandle(getRegionAtlasPreviewFileName(region));
    return fileHandle.getFile();
  } catch {
    return null;
  }
}

async function resolveRegionProjectPdfFile(region) {
  if (!region?.id) {
    return null;
  }

  const archiveHandle = await getProjectArchiveDirectoryHandle(false);
  if (!archiveHandle) {
    return null;
  }

  try {
    const packageHandle = await getProjectPlatePackageHandle(archiveHandle, region.id, region.atlasId || getActiveAtlasId());
    const fileHandle = await packageHandle.getFileHandle(getRegionProjectPdfFileName(region));
    return fileHandle.getFile();
  } catch {
    return null;
  }
}

async function renderRegionProjectPdfImage(region) {
  const requestedPage = region?.atlasPreviewPage || 1;
  const sessionPdfBytes = state.moderatorPdfBytes.get(region?.id || "");

  if (sessionPdfBytes?.length) {
    const sessionImage = await renderPdfBytesToAtlasImage(sessionPdfBytes, requestedPage);
    if (sessionImage) {
      return sessionImage;
    }
  }

  const archivedProjectFile = await resolveRegionProjectPdfFile(region);
  if (archivedProjectFile) {
    const archivedBytes = new Uint8Array(await archivedProjectFile.arrayBuffer());
    const archivedImage = await renderPdfBytesToAtlasImage(archivedBytes, requestedPage);
    if (archivedImage) {
      return archivedImage;
    }
  }

  return renderProjectAtlasPdfImage(region?.projectPdfPath || "", requestedPage);
}

function renderCanvasToJpegDataUrl(sourceCanvas, targetWidth, targetHeight, quality) {
  const outputCanvas = document.createElement("canvas");
  const outputContext = outputCanvas.getContext("2d", { alpha: false });

  if (!outputContext) {
    return "";
  }

  outputCanvas.width = Math.max(1, Math.floor(targetWidth));
  outputCanvas.height = Math.max(1, Math.floor(targetHeight));
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(sourceCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  return outputCanvas.toDataURL("image/jpeg", quality);
}

function buildBrowserStorageAtlasPreview(sourceCanvas, fallbackDataUrl = "") {
  const normalizedFallback = String(fallbackDataUrl || "").trim();

  if (normalizedFallback && normalizedFallback.length <= BROWSER_STORAGE_ATLAS_PREVIEW_MAX_CHARS) {
    return normalizedFallback;
  }

  if (!sourceCanvas?.width || !sourceCanvas?.height) {
    return normalizedFallback;
  }

  const aspectRatio = sourceCanvas.height / Math.max(1, sourceCanvas.width);
  let smallestCandidate = normalizedFallback;

  for (const targetWidth of BROWSER_STORAGE_ATLAS_PREVIEW_TARGET_WIDTHS) {
    const boundedWidth = Math.min(sourceCanvas.width, targetWidth);
    const boundedHeight = Math.max(1, Math.round(boundedWidth * aspectRatio));

    for (const quality of BROWSER_STORAGE_ATLAS_PREVIEW_QUALITIES) {
      const candidate = renderCanvasToJpegDataUrl(sourceCanvas, boundedWidth, boundedHeight, quality);

      if (!candidate) {
        continue;
      }

      if (!smallestCandidate || candidate.length < smallestCandidate.length) {
        smallestCandidate = candidate;
      }

      if (candidate.length <= BROWSER_STORAGE_ATLAS_PREVIEW_MAX_CHARS) {
        return candidate;
      }
    }
  }

  return smallestCandidate;
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
  const currentRegion = getEffectiveRegion(regionId);
  const suggestedTarget = currentRegion?.map || draft?.map || "assets/maps/your-region.jpg";
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
    (region, index) => {
      const draftTag = region.isCustomPlate ? " · Draft" : "";

      return `<option value="${escapeHtml(region.id)}">PL ${String(index + 1).padStart(2, "0")} · ${escapeHtml(region.name)}${draftTag}</option>`;
    }
  ).join("");
}

function populateModeratorForm(regionId) {
  const nextRegionId = INDEX_BY_ID.has(regionId) ? regionId : REGIONS[0]?.id || "";
  const defaults = getDefaultDraftValues(nextRegionId);

  state.moderatorRegionId = nextRegionId;
  elements.moderatorRegion.value = nextRegionId;
  elements.moderatorPlateName.value = defaults.name;
  elements.moderatorPlateUz.value = defaults.uz;
  elements.moderatorPlateType.value = defaults.type;
  elements.moderatorPlateScale.value = defaults.scale;
  elements.moderatorPlateMap.value = defaults.map;
  elements.moderatorCaption.value = defaults.caption;
  elements.moderatorSummary.value = defaults.summary;
  elements.moderatorNote.value = defaults.moderatorNote;
  elements.moderatorProjectPdfName.value = defaults.projectPdfName;
  elements.moderatorPdf.value = "";

  if (elements.moderatorPlateKey) {
    elements.moderatorPlateKey.textContent = defaults.isCustomPlate
      ? `Plate key ${nextRegionId} · Draft-only plate in ${getActiveAtlasName()}`
      : `Plate key ${nextRegionId} · Existing atlas plate`;
  }

  if (elements.moderatorDeletePlate) {
    elements.moderatorDeletePlate.hidden = !defaults.isCustomPlate;
  }

  if (defaults.sourcePdf) {
    const sizeText = defaults.sourceFileSize ? ` · ${defaults.sourceFileSize}` : "";
    const archiveText = defaults.projectPdfPath ? ` · Archived in ${defaults.projectPdfPath}` : "";
    const draftText = defaults.projectDraftPath ? ` · Record ${defaults.projectDraftPath}` : "";
    elements.moderatorFileMeta.textContent = `Recorded source PDF: ${defaults.sourcePdf}${sizeText}${archiveText}${draftText}`;
  } else {
    elements.moderatorFileMeta.textContent = "No PDF selected yet. Attach one to preview it during this session and to record its filename in the handoff package.";
  }

  updateModeratorProjectRootMeta(nextRegionId);
  updateModeratorPdfPreview(nextRegionId);
  updateModeratorCommand(nextRegionId);
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
      const region = getEffectiveRegion(draft.regionId);
      const detailParts = [];

      if (draft.isCustomPlate) {
        detailParts.push("Custom plate");
      }

      if (draft.sourcePdf) {
        detailParts.push(`Source PDF: ${draft.sourcePdf}${draft.sourceFileSize ? ` · ${draft.sourceFileSize}` : ""}`);
      }

      if (draft.projectPdfPath) {
        detailParts.push(`Project copy: ${draft.projectPdfPath}`);
      }

      if (hasSavedAtlasPreview(draft)) {
        detailParts.push(`Atlas preview saved${draft.atlasPreviewPage ? ` · Page ${draft.atlasPreviewPage}` : ""}`);
      }

      if (draft.projectDraftPath) {
        detailParts.push(`Draft record: ${draft.projectDraftPath}`);
      }

      const detail = detailParts.join(" · ") || "Description-only draft";
      const updated = draft.updatedAt ? `Updated ${draft.updatedAt}` : "Draft saved";
      const deleteLabel = draft.isCustomPlate ? "Delete plate" : "Delete draft";

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
            <button class="draft-action${draft.isCustomPlate ? " draft-action-danger" : ""}" type="button" data-action="delete" data-region-id="${escapeHtml(draft.regionId)}">${deleteLabel}</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function syncModeratorViews() {
  rebuildEffectiveRegionRegistry(state.moderatorDrafts);

  if (state.index >= REGIONS.length) {
    state.index = Math.max(0, REGIONS.length - 1);
  }

  if (state.moderatorRegionId && !INDEX_BY_ID.has(state.moderatorRegionId)) {
    state.moderatorRegionId = REGIONS[Math.min(state.index, Math.max(0, REGIONS.length - 1))]?.id || REGIONS[0]?.id || "";
  }

  updateOverview();
  populateModeratorRegionOptions();
  buildFilmstrip();
  buildModeratorDraftList();
  buildContents();
  buildClimateMaps();

  if (state.started && REGIONS.length) {
    render(state.index);
  }

  if (state.moderatorRegionId) {
    updateModeratorCommand(state.moderatorRegionId);
  }

  updateModeratorProjectRootMeta(state.moderatorRegionId);
}

function createDraftFromForm() {
  const regionId = elements.moderatorRegion.value;
  const baseRegion = getEffectiveRegion(regionId);
  const sessionFile = state.moderatorSessionFiles.get(regionId);
  const existingDraft = getDraft(regionId);
  const isCustomPlate = Boolean(existingDraft?.isCustomPlate || !BASE_INDEX_BY_ID.has(regionId));
  const resolvedName = elements.moderatorPlateName.value.trim() || baseRegion?.name || buildCustomPlateName(regionId);
  const resolvedUz = elements.moderatorPlateUz.value.trim() || baseRegion?.uz || "";
  const resolvedType = elements.moderatorPlateType.value.trim() || baseRegion?.type || DEFAULT_PLATE_TYPE;
  const resolvedScale = elements.moderatorPlateScale.value.trim() || baseRegion?.scale || DEFAULT_PLATE_SCALE;
  const resolvedMap = elements.moderatorPlateMap.value.trim() || baseRegion?.map || `assets/maps/${regionId}.jpg`;
  const requestedProjectPdfName = elements.moderatorProjectPdfName.value.trim() || existingDraft?.projectPdfName || "";
  const normalizedProjectPdfName = requestedProjectPdfName
    ? buildProjectPdfFileName(requestedProjectPdfName, regionId)
    : "";
  const archivedProjectName = existingDraft?.projectPdfName || "";
  const keepArchivedProjectPath = !normalizedProjectPdfName || !archivedProjectName || normalizedProjectPdfName === archivedProjectName;

  const draft = {
    atlasId: getActiveAtlasId(),
    regionId,
    isCustomPlate,
    customOrder: existingDraft?.customOrder ?? (isCustomPlate ? getNextCustomPlateOrder() : 0),
    name: resolvedName,
    uz: resolvedUz,
    type: resolvedType,
    scale: resolvedScale,
    map: resolvedMap,
    caption: elements.moderatorCaption.value.trim(),
    summary: elements.moderatorSummary.value.trim(),
    moderatorNote: elements.moderatorNote.value.trim(),
    sourcePdf: sessionFile?.name || existingDraft?.sourcePdf || "",
    sourceFileSize: sessionFile ? formatBytes(sessionFile.size) : existingDraft?.sourceFileSize || "",
    projectPdfName: requestedProjectPdfName,
    projectPdfPath: keepArchivedProjectPath ? existingDraft?.projectPdfPath || "" : "",
    projectPdfSavedAt: keepArchivedProjectPath ? existingDraft?.projectPdfSavedAt || "" : "",
    projectDraftPath: existingDraft?.projectDraftPath || "",
    projectDraftSavedAt: existingDraft?.projectDraftSavedAt || "",
    atlasPreviewPath: existingDraft?.atlasPreviewPath || "",
    atlasPreviewSavedAt: existingDraft?.atlasPreviewSavedAt || "",
    atlasPreviewImage: existingDraft?.atlasPreviewPath ? "" : existingDraft?.atlasPreviewImage || "",
    atlasPreviewPage: existingDraft?.atlasPreviewPage || 0,
    updatedAt: new Date().toLocaleString()
  };

  const isMeaningful =
    isCustomPlate ||
    draft.name !== (baseRegion?.name || "") ||
    draft.uz !== (baseRegion?.uz || "") ||
    draft.type !== (baseRegion?.type || DEFAULT_PLATE_TYPE) ||
    draft.scale !== (baseRegion?.scale || DEFAULT_PLATE_SCALE) ||
    draft.map !== (baseRegion?.map || "") ||
    draft.caption !== (baseRegion?.caption || "") ||
    draft.summary !== (baseRegion?.summary || "") ||
    Boolean(draft.moderatorNote) ||
    Boolean(draft.sourcePdf) ||
    Boolean(draft.projectPdfName) ||
    hasSavedAtlasPreview(draft);

  return isMeaningful ? draft : null;
}

async function saveModeratorDraft() {
  const draft = createDraftFromForm();
  const regionId = elements.moderatorRegion.value;
  const currentRegion = getEffectiveRegion(regionId);

  if (!draft) {
    state.moderatorDrafts.delete(regionId);
    persistDrafts();
    syncModeratorViews();
    populateModeratorForm(state.moderatorRegionId || REGIONS[0]?.id || "");
    setModeratorStatus("No custom draft content remained for this plate, so the saved draft was cleared.");
    return;
  }

  let nextDraft = draft;
  let archiveHandle = null;
  let archiveErrorMessage = "";
  const projectPdfFile = await resolveModeratorProjectPdfFile(regionId, [nextDraft, getDraft(regionId), currentRegion]);

  try {
    const projectResult = await syncDraftToProjectArchive({
      draft: nextDraft,
      regionId,
      sessionFile: projectPdfFile,
      savePdfCopy: Boolean(projectPdfFile),
      promptForHandle: false,
      reason: "draft-save"
    });

    if (projectResult.saved) {
      nextDraft = projectResult.draft;
      archiveHandle = projectResult.archiveHandle;
    }
  } catch (error) {
    if (error?.name === "ProjectArchiveRootError") {
      archiveErrorMessage = error.message;
      updateModeratorProjectRootMeta(regionId);
    }

    archiveHandle = null;
  }

  state.moderatorDrafts.set(regionId, nextDraft);

  if (archiveHandle) {
    await writeProjectArchiveManifest(archiveHandle, new Map(state.moderatorDrafts));
  }

  persistDrafts();
  syncModeratorViews();
  populateModeratorForm(regionId);
  setModeratorStatus(
    archiveHandle
      ? `Draft saved for ${getEffectiveRegion(regionId)?.name}. Project record updated in ${nextDraft.projectDraftPath}.`
      : archiveErrorMessage
        ? `${archiveErrorMessage} The draft was only saved in browser storage for ${getEffectiveRegion(regionId)?.name}.`
        : `Draft saved for ${getEffectiveRegion(regionId)?.name}.`
  );
}

async function archiveModeratorPdfToProject() {
  const regionId = elements.moderatorRegion.value;
  const currentRegion = getEffectiveRegion(regionId);
  const existingDraft = getDraft(regionId);
  const projectPdfFile = await resolveModeratorProjectPdfFile(regionId, [existingDraft, currentRegion]);

  if (!projectPdfFile) {
    setModeratorStatus("Attach the source PDF again, or keep an existing project copy available, before archiving this plate package into the project folder.", true);
    return;
  }

  if (typeof window.showDirectoryPicker !== "function") {
    setModeratorStatus(
      "Project archiving needs a Chromium browser over local HTTP so the atlas can ask for write access to the project folder.",
      true
    );
    return;
  }

  const timestamp = new Date().toLocaleString();
  let nextDraft = {
    ...(createDraftFromForm() || {
      atlasId: getActiveAtlasId(),
      regionId,
      name: existingDraft?.name || currentRegion?.name || buildCustomPlateName(regionId),
      uz: existingDraft?.uz || currentRegion?.uz || "",
      type: existingDraft?.type || currentRegion?.type || DEFAULT_PLATE_TYPE,
      scale: existingDraft?.scale || currentRegion?.scale || DEFAULT_PLATE_SCALE,
      map: existingDraft?.map || currentRegion?.map || `assets/maps/${regionId}.jpg`,
      caption: elements.moderatorCaption.value.trim() || existingDraft?.caption || currentRegion?.caption || "",
      summary: elements.moderatorSummary.value.trim() || existingDraft?.summary || currentRegion?.summary || "",
      moderatorNote: elements.moderatorNote.value.trim() || existingDraft?.moderatorNote || "",
      sourcePdf: projectPdfFile.name,
      sourceFileSize: formatBytes(projectPdfFile.size),
      projectDraftPath: existingDraft?.projectDraftPath || "",
      projectDraftSavedAt: existingDraft?.projectDraftSavedAt || "",
      atlasPreviewPath: existingDraft?.atlasPreviewPath || "",
      atlasPreviewSavedAt: existingDraft?.atlasPreviewSavedAt || "",
      atlasPreviewImage: existingDraft?.atlasPreviewPath ? "" : existingDraft?.atlasPreviewImage || "",
      atlasPreviewPage: existingDraft?.atlasPreviewPage || 0,
      updatedAt: timestamp
    }),
    sourcePdf: projectPdfFile.name,
    sourceFileSize: formatBytes(projectPdfFile.size),
    updatedAt: timestamp
  };
  let nextDraftMap = new Map(state.moderatorDrafts);

  try {
    setModeratorStatus("Archiving this plate package into the connected save folder.");
    const projectResult = await syncDraftToProjectArchive({
      draft: nextDraft,
      regionId,
      sessionFile: projectPdfFile,
      savePdfCopy: true,
      promptForHandle: false,
      reason: "archive-pdf"
    });

    if (!projectResult.saved) {
      updateModeratorProjectRootMeta(regionId);
      setModeratorStatus("Connect a save folder first, then archive this plate package.", true);
      return;
    }

    nextDraft = projectResult.draft;
    nextDraftMap.set(regionId, nextDraft);
    const archiveHandle = projectResult.archiveHandle;
    await writeProjectArchiveManifest(archiveHandle, nextDraftMap);
  } catch (error) {
    if (error?.name === "AbortError") {
      setModeratorStatus("Project archive save was cancelled before the atlas project folder was updated.", true);
      return;
    }

    if (error?.name === "ProjectArchiveRootError") {
      state.projectArchiveRootHandle = null;
      state.projectArchiveConnectionMode = "";
      updateModeratorProjectRootMeta(regionId);
      setModeratorStatus(error.message, true);
      return;
    }

    state.projectArchiveRootHandle = null;
    state.projectArchiveConnectionMode = "";
    updateModeratorProjectRootMeta(regionId);
    setModeratorStatus(
      `Could not archive ${projectPdfFile.name} into ${MODERATOR_PROJECT_ARCHIVE_PATH}. Recheck folder permissions and try again.`,
      true
    );
    return;
  }

  state.moderatorDrafts = nextDraftMap;
  persistDrafts();
  syncModeratorViews();
  populateModeratorForm(regionId);
  setModeratorStatus(
    `Saved ${nextDraft.projectPdfName || projectPdfFile.name} into ${MODERATOR_PROJECT_ARCHIVE_PATH} and updated ${MODERATOR_PROJECT_MANIFEST_FILE} for ${currentRegion?.name || regionId}.`
  );
}

async function integrateModeratorPdfIntoAtlas() {
  const regionId = elements.moderatorRegion.value;
  const currentRegion = getEffectiveRegion(regionId);
  const existingDraft = getDraft(regionId);
  const projectPdfFile = await resolveModeratorProjectPdfFile(regionId, [existingDraft, currentRegion]);
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
    name: existingDraft?.name || currentRegion?.name || buildCustomPlateName(regionId),
    uz: existingDraft?.uz || currentRegion?.uz || "",
    type: existingDraft?.type || currentRegion?.type || DEFAULT_PLATE_TYPE,
    scale: existingDraft?.scale || currentRegion?.scale || DEFAULT_PLATE_SCALE,
    map: existingDraft?.map || currentRegion?.map || `assets/maps/${regionId}.jpg`,
    caption: elements.moderatorCaption.value.trim() || existingDraft?.caption || currentRegion?.caption || "",
    summary: elements.moderatorSummary.value.trim() || existingDraft?.summary || currentRegion?.summary || "",
    moderatorNote: elements.moderatorNote.value.trim() || existingDraft?.moderatorNote || "",
    sourcePdf: projectPdfFile?.name || existingDraft?.sourcePdf || currentRegion?.sourcePdf || "",
    sourceFileSize: projectPdfFile
      ? formatBytes(projectPdfFile.size)
      : existingDraft?.sourceFileSize || currentRegion?.sourceFileSize || "",
    projectPdfName: existingDraft?.projectPdfName || currentRegion?.projectPdfName || "",
    projectPdfPath: existingDraft?.projectPdfPath || currentRegion?.projectPdfPath || "",
    projectPdfSavedAt: existingDraft?.projectPdfSavedAt || currentRegion?.projectPdfSavedAt || "",
    projectDraftPath: existingDraft?.projectDraftPath || currentRegion?.projectDraftPath || "",
    projectDraftSavedAt: existingDraft?.projectDraftSavedAt || currentRegion?.projectDraftSavedAt || "",
    atlasPreviewPath: existingDraft?.atlasPreviewPath || currentRegion?.atlasPreviewPath || "",
    atlasPreviewSavedAt: existingDraft?.atlasPreviewSavedAt || currentRegion?.atlasPreviewSavedAt || "",
    atlasPreviewImage: existingDraft?.atlasPreviewPath ? "" : existingDraft?.atlasPreviewImage || "",
    atlasPreviewPage: existingDraft?.atlasPreviewPage || 0,
    updatedAt: new Date().toLocaleString()
  };
  let nextDraft = {
    ...(createDraftFromForm() || fallbackDraft),
    atlasPreviewPath: existingDraft?.atlasPreviewPath || fallbackDraft.atlasPreviewPath || "",
    atlasPreviewSavedAt: existingDraft?.atlasPreviewSavedAt || fallbackDraft.atlasPreviewSavedAt || "",
    atlasPreviewImage,
    atlasPreviewPage: pageNumber,
    updatedAt: new Date().toLocaleString()
  };

  let archiveHandle = null;
  let archiveErrorMessage = "";

  try {
    const projectResult = await syncDraftToProjectArchive({
      draft: nextDraft,
      regionId,
      sessionFile: projectPdfFile,
      previewDataUrl: atlasPreviewImage,
      previewPage: pageNumber,
      savePdfCopy: Boolean(projectPdfFile),
      promptForHandle: false,
      reason: "integrate-preview"
    });

    if (projectResult.saved) {
      nextDraft = projectResult.draft;
      archiveHandle = projectResult.archiveHandle;
    }
  } catch (error) {
    if (error?.name === "ProjectArchiveRootError") {
      archiveErrorMessage = error.message;
      state.projectArchiveRootHandle = null;
      state.projectArchiveConnectionMode = "";
      updateModeratorProjectRootMeta(regionId);
    }

    if (error?.name === "AbortError") {
      archiveHandle = null;
    }
  }

  const browserStoragePreviewImage = buildBrowserStorageAtlasPreview(canvas, atlasPreviewImage);

  if (!archiveHandle || state.projectArchiveConnectionMode === PROJECT_ARCHIVE_CONNECTION_ATLAS_FOLDER) {
    nextDraft = {
      ...nextDraft,
      atlasPreviewImage: browserStoragePreviewImage || nextDraft.atlasPreviewImage || "",
      atlasPreviewStorageImage: browserStoragePreviewImage
    };
  } else if (nextDraft.atlasPreviewStorageImage) {
    nextDraft = { ...nextDraft };
    delete nextDraft.atlasPreviewStorageImage;
  }

  state.moderatorDrafts.set(regionId, nextDraft);

  if (archiveHandle) {
    await writeProjectArchiveManifest(archiveHandle, new Map(state.moderatorDrafts));
  }

  try {
    persistDrafts();
  } catch {
    syncModeratorViews();
    populateModeratorForm(regionId);
    setModeratorStatus(
      archiveHandle
        ? `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId} and saved the preview to ${nextDraft.atlasPreviewPath}, but browser storage could not be updated for this profile.`
        : archiveErrorMessage
          ? `${archiveErrorMessage} The plate preview is available until this page reloads, but browser storage could not keep a durable copy.`
          : "Could not persist the integrated atlas preview in browser storage. The preview is available until this page reloads; connect a save folder for a durable save.",
      true
    );
    return;
  }

  syncModeratorViews();
  populateModeratorForm(regionId);
  setModeratorStatus(
    archiveHandle
      ? projectPdfFile
        ? `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId} and saved the plate package in ${nextDraft.projectDraftPath}.`
        : `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId} and saved the preview and latest.json in ${nextDraft.projectDraftPath}. Re-attach the source PDF if you want it copied into the same folder too.`
      : archiveErrorMessage
        ? `${archiveErrorMessage} The plate preview was only kept in browser storage for the current profile.`
      : !state.projectArchiveRootHandle
        ? `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId}. Connect a save folder to also save the PDF, JPG, and latest.json.`
      : usedPreviewFallback
        ? `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId} using the visible preview size. Use Preview in atlas to inspect it.`
        : `Integrated page ${pageNumber} of ${nextDraft.sourcePdf || "the PDF"} into the atlas for ${currentRegion?.name || regionId} with a higher-resolution PDF render. Use Preview in atlas to inspect it.`
  );
}

function deleteModeratorDraft(regionId) {
  const deletedRegionName = getEffectiveRegion(regionId)?.name || regionId;
  const wasSelected = state.moderatorRegionId === regionId;

  state.moderatorDrafts.delete(regionId);
  persistDrafts();
  revokeModeratorPdf(regionId);
  syncModeratorViews();

  if (wasSelected) {
    populateModeratorForm(state.moderatorRegionId || REGIONS[0]?.id || "");
  }

  setModeratorStatus(`Removed the saved draft for ${deletedRegionName}. The base atlas plate remains available.`);
}

async function deleteModeratorPlate(regionId) {
  const draft = getDraft(regionId);

  if (!draft?.isCustomPlate) {
    setModeratorStatus("Only draft-only custom plates can be deleted from the atlas.", true);
    return;
  }

  const deletedRegionName = getEffectiveRegion(regionId)?.name || draft.name || regionId;
  const wasSelected = state.moderatorRegionId === regionId;

  try {
    const projectResult = await syncDraftToProjectArchive({
      draft: {
        ...draft,
        updatedAt: new Date().toLocaleString()
      },
      regionId,
      sessionFile: state.moderatorSessionFiles.get(regionId),
      promptForHandle: false,
      reason: "delete-plate",
      deleted: true
    });

    if (projectResult.saved) {
      const nextDraftMap = new Map(state.moderatorDrafts);
      nextDraftMap.delete(regionId);
      await writeProjectArchiveManifest(projectResult.archiveHandle, nextDraftMap);
    }
  } catch {
    // Keep deletion local even if archive history update fails.
  }

  state.moderatorDrafts.delete(regionId);
  persistDrafts();
  revokeModeratorPdf(regionId);
  syncModeratorViews();

  if (wasSelected) {
    populateModeratorForm(state.moderatorRegionId || REGIONS[0]?.id || "");
  }

  setModeratorStatus(`Deleted plate ${deletedRegionName} from ${getActiveAtlasName()}. Archived history was preserved when project access was available.`);
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

function openClimateMaps() {
  if (!getClimateMapDocuments().length) {
    return;
  }

  if (state.currentScene !== "climateMaps") {
    state.returnScene = state.currentScene;
  }

  showScene("climateMaps");
  buildClimateMaps();
  window.requestAnimationFrame(() => {
    elements.climateMapsSearch?.focus();
  });
}

function closeClimateMaps() {
  const nextScene = state.returnScene || (state.started ? "album" : "cover");
  showScene(nextScene);

  if (state.currentScene === "album") {
    fitImage();
  }
}

function openLibrary() {
  if (!SOURCE_DOCUMENTS.length) {
    return;
  }

  if (state.currentScene !== "library") {
    state.returnScene = state.currentScene;
  }

  showScene("library");
  populateLibraryCollectionOptions();
  buildLibraryList();

  renderLibraryDocument(getLibraryDocumentById(state.librarySelectedId), { loadPdf: false });

  window.requestAnimationFrame(() => {
    elements.librarySearch?.focus();
  });
}

function openLibraryDocument(documentId) {
  flushLibraryNoteSave();
  const sourceDocument = getLibraryDocumentById(documentId);

  if (!sourceDocument) {
    return;
  }

  if (state.currentScene !== "library") {
    state.returnScene = state.currentScene;
  }

  state.librarySelectedId = sourceDocument.id;
  state.libraryCollection = "all";
  state.libraryQuery = "";

  if (elements.librarySearch) {
    elements.librarySearch.value = "";
  }

  showScene("library");
  populateLibraryCollectionOptions();
  buildLibraryList();
  renderLibraryDocument(sourceDocument, { loadPdf: true });
}

function closeLibrary() {
  flushLibraryNoteSave();
  abortLibraryAiRequest();
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
  if (SOURCE_DOCUMENTS.length) {
    openContents();
    return;
  }

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

  if (elements.moderatorAddPlate) {
    elements.moderatorAddPlate.addEventListener("click", createCustomModeratorPlate);
  }

  elements.btnBegin.addEventListener("click", beginAtlas);
  if (elements.btnOpenLibrary) {
    elements.btnOpenLibrary.addEventListener("click", openLibrary);
  }
  if (elements.btnOpenClimateMaps) {
    elements.btnOpenClimateMaps.addEventListener("click", openClimateMaps);
  }
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
  elements.btnLibrary.addEventListener("click", () => {
    if (state.currentScene === "library") {
      closeLibrary();
      return;
    }

    openLibrary();
  });
  elements.btnClimateMaps.addEventListener("click", () => {
    if (state.currentScene === "climateMaps") {
      closeClimateMaps();
      return;
    }

    openClimateMaps();
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
  elements.climateMapsClose.addEventListener("click", closeClimateMaps);
  elements.libraryClose.addEventListener("click", closeLibrary);
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
      const visibleReports = getVisibleReportDocuments();

      if (visibleReports.length === 1) {
        openLibraryDocument(visibleReports[0].id);
      }
    }
  });

  elements.climateMapsSearch.addEventListener("input", (event) => {
    state.climateMapQuery = event.target.value;
    buildClimateMaps();
  });

  elements.climateMapsSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const visibleClimateMaps = getVisibleClimateMapDocuments();

      if (visibleClimateMaps.length === 1) {
        openLibraryDocument(visibleClimateMaps[0].id);
      }
    }
  });

  elements.librarySearch.addEventListener("input", (event) => {
    state.libraryQuery = event.target.value;
    buildLibraryList();
  });

  elements.librarySearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const visibleDocuments = getVisibleLibraryDocuments();

      if (visibleDocuments.length === 1) {
        selectLibraryDocument(visibleDocuments[0].id);
      }
    }
  });

  elements.libraryCategory.addEventListener("change", (event) => {
    state.libraryCollection = event.target.value;
    buildLibraryList();
  });

  elements.libraryPrev.addEventListener("click", () => {
    if (state.libraryPage > 1) {
      flushLibraryNoteSave();
      void renderLibraryPdfPage(state.libraryPage - 1);
    }
  });

  elements.libraryNext.addEventListener("click", () => {
    if (state.libraryPage < state.libraryPageCount) {
      flushLibraryNoteSave();
      void renderLibraryPdfPage(state.libraryPage + 1);
    }
  });

  elements.libraryZoomOut.addEventListener("click", () => {
    state.libraryZoom = Math.max(SOURCE_LIBRARY_MIN_ZOOM, Number((state.libraryZoom / 1.2).toFixed(2)));
    void renderLibraryPdfPage(state.libraryPage);
  });

  elements.libraryZoomIn.addEventListener("click", () => {
    state.libraryZoom = Math.min(SOURCE_LIBRARY_MAX_ZOOM, Number((state.libraryZoom * 1.2).toFixed(2)));
    void renderLibraryPdfPage(state.libraryPage);
  });

  elements.libraryZoomFit.addEventListener("click", () => {
    state.libraryZoom = 1;
    void renderLibraryPdfPage(state.libraryPage);
  });

  elements.libraryNote.addEventListener("input", () => {
    window.clearTimeout(state.libraryNoteSaveTimer);
    elements.libraryNoteStatus.textContent = `Saving page ${state.libraryPage} notes...`;
    elements.libraryNoteStatus.classList.remove("is-alert");
    state.libraryNoteSaveTimer = window.setTimeout(persistSelectedLibraryNote, 250);
  });

  elements.libraryAiExplain?.addEventListener("click", () => {
    void explainSelectedLibraryPage();
  });

  elements.libraryAiCopy?.addEventListener("click", insertLibraryAiIntoNotes);
  elements.libraryAiAvatar?.addEventListener("click", nudgeLibraryAiAvatar);

  elements.moderatorRegion.addEventListener("change", (event) => {
    populateModeratorForm(event.target.value);
    setModeratorStatus("");
  });

  elements.moderatorProjectRoot?.addEventListener("click", async () => {
    await connectModeratorProjectRoot();
  });

  [elements.moderatorProjectPdfName, elements.moderatorPlateMap].forEach((input) => {
    input?.addEventListener("input", () => {
      if (elements.moderatorRegion.value) {
        updateModeratorCommand(elements.moderatorRegion.value);
      }
    });
  });

  elements.moderatorPdf.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    const regionId = elements.moderatorRegion.value;
    const currentRegion = getEffectiveRegion(regionId);
    const existingDraft = getDraft(regionId);

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

    let autoArchiveSaved = false;
    let autoArchiveSkipped = false;
    let autoArchiveErrorMessage = "";

    try {
      const autoArchiveDraft = {
        ...(createDraftFromForm() || {
          atlasId: getActiveAtlasId(),
          regionId,
          name: existingDraft?.name || currentRegion?.name || buildCustomPlateName(regionId),
          uz: existingDraft?.uz || currentRegion?.uz || "",
          type: existingDraft?.type || currentRegion?.type || DEFAULT_PLATE_TYPE,
          scale: existingDraft?.scale || currentRegion?.scale || DEFAULT_PLATE_SCALE,
          map: existingDraft?.map || currentRegion?.map || `assets/maps/${regionId}.jpg`,
          caption: elements.moderatorCaption.value.trim() || existingDraft?.caption || currentRegion?.caption || "",
          summary: elements.moderatorSummary.value.trim() || existingDraft?.summary || currentRegion?.summary || "",
          moderatorNote: elements.moderatorNote.value.trim() || existingDraft?.moderatorNote || "",
          sourcePdf: file.name,
          sourceFileSize: formatBytes(file.size),
          projectPdfName: elements.moderatorProjectPdfName.value.trim() || existingDraft?.projectPdfName || file.name,
          projectPdfPath: existingDraft?.projectPdfPath || currentRegion?.projectPdfPath || "",
          projectPdfSavedAt: existingDraft?.projectPdfSavedAt || currentRegion?.projectPdfSavedAt || "",
          projectDraftPath: existingDraft?.projectDraftPath || currentRegion?.projectDraftPath || "",
          projectDraftSavedAt: existingDraft?.projectDraftSavedAt || currentRegion?.projectDraftSavedAt || "",
          atlasPreviewPath: existingDraft?.atlasPreviewPath || currentRegion?.atlasPreviewPath || "",
          atlasPreviewSavedAt: existingDraft?.atlasPreviewSavedAt || currentRegion?.atlasPreviewSavedAt || "",
          atlasPreviewImage: existingDraft?.atlasPreviewPath ? "" : existingDraft?.atlasPreviewImage || currentRegion?.atlasPreviewImage || "",
          atlasPreviewPage: existingDraft?.atlasPreviewPage || currentRegion?.atlasPreviewPage || 0,
          updatedAt: new Date().toLocaleString()
        }),
        sourcePdf: file.name,
        sourceFileSize: formatBytes(file.size),
        updatedAt: new Date().toLocaleString()
      };
      const projectResult = await syncDraftToProjectArchive({
        draft: autoArchiveDraft,
        regionId,
        sessionFile: file,
        savePdfCopy: true,
        promptForHandle: false,
        reason: "pdf-selected"
      });

      if (projectResult.saved) {
        autoArchiveSaved = true;
        state.moderatorDrafts.set(regionId, projectResult.draft);
        await writeProjectArchiveManifest(projectResult.archiveHandle, new Map(state.moderatorDrafts));
        persistDrafts();
        syncModeratorViews();
        populateModeratorForm(regionId);
      } else {
        autoArchiveSkipped = true;
      }
    } catch (error) {
      if (error?.name === "ProjectArchiveRootError") {
        autoArchiveErrorMessage = error.message;
        state.projectArchiveRootHandle = null;
        state.projectArchiveConnectionMode = "";
        updateModeratorProjectRootMeta(regionId);
      }

      if (error?.name !== "AbortError") {
        state.projectArchiveRootHandle = null;
        state.projectArchiveConnectionMode = "";
        updateModeratorProjectRootMeta(regionId);
      }
    }

    if (pdfBytes) {
      setModeratorStatus(
        autoArchiveSaved
          ? `Attached ${file.name}, stored it in ${getDraft(regionId)?.projectPdfPath || MODERATOR_PROJECT_ARCHIVE_PATH}, and updated ${getDraft(regionId)?.projectDraftPath || "the draft record"}. The preview is rendering now.`
          : autoArchiveErrorMessage
            ? `${autoArchiveErrorMessage} ${file.name} is attached for this session, but it is not yet archived into the repo.`
          : autoArchiveSkipped
            ? `Attached ${file.name}. The preview is rendering now; use Connect save folder to archive the plate package.`
            : `Attached ${file.name}. The preview is rendering now; save the draft to record it in the handoff package.`
      );
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

  elements.moderatorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveModeratorDraft();
  });

  elements.moderatorArchive.addEventListener("click", archiveModeratorPdfToProject);
  elements.moderatorIntegrate.addEventListener("click", integrateModeratorPdfIntoAtlas);
  elements.moderatorPreview.addEventListener("click", previewModeratorRegion);
  elements.moderatorDeletePlate?.addEventListener("click", async () => {
    await deleteModeratorPlate(elements.moderatorRegion.value);
  });
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

  elements.moderatorDraftList.addEventListener("click", async (event) => {
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
      if (getDraft(regionId)?.isCustomPlate) {
        await deleteModeratorPlate(regionId);
        return;
      }

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

      if (event.key === "Escape" && state.currentScene === "library" && state.libraryQuery) {
        state.libraryQuery = "";
        elements.librarySearch.value = "";
        buildLibraryList();
        event.preventDefault();
      }

      if (event.key === "Escape" && state.currentScene === "climateMaps" && state.climateMapQuery) {
        state.climateMapQuery = "";
        elements.climateMapsSearch.value = "";
        buildClimateMaps();
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
      } else if (event.key.toLowerCase() === "k") {
        openClimateMaps();
      } else if (event.key.toLowerCase() === "l") {
        openLibrary();
      } else if (MODERATOR_ENABLED && event.key.toLowerCase() === "m") {
        openModerator();
      }

      return;
    }

    if (state.currentScene === "contents") {
      if (event.key === "Escape") {
        closeContents();
      } else if (event.key.toLowerCase() === "k") {
        openClimateMaps();
      } else if (event.key.toLowerCase() === "l") {
        openLibrary();
      } else if (MODERATOR_ENABLED && event.key.toLowerCase() === "m") {
        openModerator();
      }

      return;
    }

    if (state.currentScene === "climateMaps") {
      if (event.key === "Escape") {
        closeClimateMaps();
      } else if (event.key.toLowerCase() === "l") {
        openLibrary();
      } else if (event.key.toLowerCase() === "c") {
        openContents();
      }

      return;
    }

    if (state.currentScene === "library") {
      if (event.key === "Escape") {
        closeLibrary();
      } else if (event.key === "ArrowLeft") {
        if (state.libraryPage > 1) {
          flushLibraryNoteSave();
          void renderLibraryPdfPage(state.libraryPage - 1);
        }
      } else if (event.key === "ArrowRight") {
        if (state.libraryPage < state.libraryPageCount) {
          flushLibraryNoteSave();
          void renderLibraryPdfPage(state.libraryPage + 1);
        }
      } else if (event.key.toLowerCase() === "e") {
        if (elements.libraryAiExplain && !elements.libraryAiExplain.disabled) {
          void explainSelectedLibraryPage();
        }
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
    } else if (event.key.toLowerCase() === "k") {
      openClimateMaps();
    } else if (event.key.toLowerCase() === "l") {
      openLibrary();
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
  syncLibraryAvailability();
  syncModeratorPreviewHint();
  populateLibraryCollectionOptions();
  buildLibraryList();
  renderLibraryDocument(getLibraryDocumentById(state.librarySelectedId), { loadPdf: false });

  if (REGIONS.length) {
    setTheme(getEffectiveRegion(REGIONS[0]) || REGIONS[0]);
    populateModeratorRegionOptions();
    populateModeratorForm(state.moderatorRegionId || REGIONS[0].id);
    buildFilmstrip();
    buildContents();
    buildClimateMaps();
    buildModeratorDraftList();
    syncNavigation();
  }

  syncFullscreenLabel();
  wireEvents();
  void restoreStoredProjectArchiveRootHandle().then(async () => {
    await syncProjectArchiveDraftsFromHandle();
    updateModeratorProjectRootMeta(state.moderatorRegionId || REGIONS[0]?.id || "");
  }).catch(() => {
    // Ignore restoration errors and fall back to reconnecting manually.
  });
}
