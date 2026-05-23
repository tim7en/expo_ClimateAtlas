const REGIONS = Array.isArray(window.REGIONS) ? window.REGIONS : [];
const ATLAS_GLOSSARY = Array.isArray(window.ATLAS_GLOSSARY) ? window.ATLAS_GLOSSARY : [];
const ATLAS_OVERVIEW = window.ATLAS_OVERVIEW || {};
const MODERATOR_DRAFTS = Array.isArray(window.MODERATOR_DRAFTS) ? window.MODERATOR_DRAFTS : [];
const INDEX_BY_ID = new Map(REGIONS.map((region, index) => [region.id, index]));
const MODERATOR_STORAGE_KEY = "atlasModeratorDraftsV1";

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
  index: 0,
  started: false,
  currentScene: "cover",
  returnScene: "cover",
  query: "",
  animating: false,
  hintDismissed: false,
  mapReady: false,
  pendingMapId: null,
  moderatorDrafts: mergeDraftMaps(buildDraftMap(MODERATOR_DRAFTS), loadStoredDrafts()),
  moderatorRegionId: REGIONS[0]?.id ?? "",
  moderatorPdfUrls: new Map(),
  moderatorSessionFiles: new Map()
};

const view = {
  scale: 1,
  fit: 1,
  x: 0,
  y: 0
};

const elements = {
  cover: document.querySelector("#cover"),
  album: document.querySelector("#album"),
  contents: document.querySelector("#contents"),
  moderator: document.querySelector("#moderator"),
  metricPlates: document.querySelector("#metric-plates"),
  metricRivers: document.querySelector("#metric-rivers"),
  metricSea: document.querySelector("#metric-sea"),
  btnBegin: document.querySelector("#btnBegin"),
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
  contentsSearch: document.querySelector("#contents-search"),
  contentsCount: document.querySelector("#contents-count"),
  contentsGrid: document.querySelector("#cgrid"),
  cClose: document.querySelector("#cClose"),
  moderatorBack: document.querySelector("#moderator-back"),
  moderatorForm: document.querySelector("#moderator-form"),
  moderatorRegion: document.querySelector("#moderator-region"),
  moderatorPdf: document.querySelector("#moderator-pdf"),
  moderatorFileMeta: document.querySelector("#moderator-file-meta"),
  moderatorCaption: document.querySelector("#moderator-caption"),
  moderatorSummary: document.querySelector("#moderator-summary"),
  moderatorNote: document.querySelector("#moderator-note"),
  moderatorPreview: document.querySelector("#moderator-preview"),
  moderatorReset: document.querySelector("#moderator-reset"),
  moderatorExport: document.querySelector("#moderator-export"),
  moderatorImport: document.querySelector("#moderator-import"),
  moderatorPdfStage: document.querySelector("#moderator-pdf-stage"),
  moderatorPdfPreview: document.querySelector("#moderator-pdf-preview"),
  moderatorPdfEmpty: document.querySelector("#moderator-pdf-empty"),
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

function normalizeDraft(rawDraft) {
  if (!rawDraft || typeof rawDraft !== "object") {
    return null;
  }

  const regionId = String(rawDraft.regionId || rawDraft.id || "").trim();
  if (!regionId || !INDEX_BY_ID.has(regionId)) {
    return null;
  }

  const normalized = {
    regionId,
    caption: String(rawDraft.caption || "").trim(),
    summary: String(rawDraft.summary || "").trim(),
    moderatorNote: String(rawDraft.moderatorNote || rawDraft.note || "").trim(),
    sourcePdf: String(rawDraft.sourcePdf || rawDraft.pdfName || "").trim(),
    sourceFileSize: String(rawDraft.sourceFileSize || "").trim(),
    updatedAt: String(rawDraft.updatedAt || "").trim()
  };

  return normalized;
}

function buildDraftMap(drafts) {
  const draftMap = new Map();

  (drafts || []).forEach((draft) => {
    const normalized = normalizeDraft(draft);

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

function loadStoredDrafts() {
  try {
    const raw = window.localStorage.getItem(MODERATOR_STORAGE_KEY);

    if (!raw) {
      return new Map();
    }

    return buildDraftMap(JSON.parse(raw));
  } catch {
    return new Map();
  }
}

function persistDrafts() {
  window.localStorage.setItem(MODERATOR_STORAGE_KEY, JSON.stringify(serializeDraftMap(state.moderatorDrafts)));
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

  const draft = getDraft(baseRegion.id);
  if (!draft) {
    return { ...baseRegion };
  }

  return {
    ...baseRegion,
    caption: draft.caption || baseRegion.caption,
    summary: draft.summary || baseRegion.summary,
    moderatorNote: draft.moderatorNote || baseRegion.moderatorNote || "",
    sourcePdf: draft.sourcePdf || baseRegion.sourcePdf || "",
    sourceFileSize: draft.sourceFileSize || baseRegion.sourceFileSize || "",
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
  elements.cover.hidden = sceneName !== "cover";
  elements.album.hidden = sceneName !== "album";
  elements.contents.hidden = sceneName !== "contents";
  elements.moderator.hidden = sceneName !== "moderator";
  state.currentScene = sceneName;
}

function updateOverview() {
  elements.metricPlates.textContent = String(REGIONS.length);
  elements.metricRivers.textContent = String(ATLAS_OVERVIEW.riverCount || 2);
  elements.metricSea.textContent = String(ATLAS_OVERVIEW.seaCount || 1);
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

  if (region.sourcePdf) {
    draftFacts.push({
      key: "focus",
      label: "Source PDF",
      value: region.sourceFileSize ? `${region.sourcePdf} · ${region.sourceFileSize}` : region.sourcePdf
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
    elements.mapImage.alt = `${region.name} climate and water plate`;
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
        No climate plates match this filter. Clear the search or add broader keywords
        in js/regions.js so the contents view can surface them.
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
    sourceFileSize: getDraft(regionId)?.sourceFileSize || ""
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

  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
    state.moderatorPdfUrls.delete(regionId);
  }

  state.moderatorSessionFiles.delete(regionId);
}

function updateModeratorPdfPreview(regionId) {
  const pdfUrl = state.moderatorPdfUrls.get(regionId);
  const draft = getDraft(regionId);

  if (pdfUrl) {
    elements.moderatorPdfPreview.data = pdfUrl;
    elements.moderatorPdfStage.classList.add("has-pdf");
    return;
  }

  elements.moderatorPdfPreview.removeAttribute("data");
  elements.moderatorPdfStage.classList.remove("has-pdf");

  if (draft?.sourcePdf) {
    elements.moderatorPdfEmpty.textContent = `Draft PDF recorded: ${draft.sourcePdf}. Re-attach the file in this browser session to preview it here.`;
    return;
  }

  elements.moderatorPdfEmpty.textContent = "Upload a regional PDF to preview it here. The atlas can record the file name and description now, then your associate can convert the PDF pages to JPG plates with the existing Python tool.";
}

function updateModeratorCommand(regionId) {
  const draft = getDraft(regionId);
  const pdfName = draft?.sourcePdf || "your-region-map.pdf";
  const baseRegion = REGIONS[INDEX_BY_ID.get(regionId)];
  const suggestedTarget = baseRegion?.map || "assets/maps/your-region.jpg";

  elements.moderatorCommand.textContent = [
    `python tools/apply_moderator_handoff.py moderator-handoff.json`,
    `python tools/extract_maps.py "pdfs/${pdfName}" --output-dir assets/maps`,
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
  elements.moderatorPdf.value = "";

  if (defaults.sourcePdf) {
    const sizeText = defaults.sourceFileSize ? ` · ${defaults.sourceFileSize}` : "";
    elements.moderatorFileMeta.textContent = `Recorded source PDF: ${defaults.sourcePdf}${sizeText}`;
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
        No moderator drafts saved yet. Pick a region, add a PDF reference and a description,
        then save the draft to create a handoff package.
      </div>
    `;
    return;
  }

  elements.moderatorDraftList.innerHTML = drafts
    .map((draft) => {
      const region = REGIONS[INDEX_BY_ID.get(draft.regionId)];
      const detail = draft.sourcePdf
        ? `Source PDF: ${draft.sourcePdf}${draft.sourceFileSize ? ` · ${draft.sourceFileSize}` : ""}`
        : "Description-only draft";
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

  const draft = {
    regionId,
    caption: elements.moderatorCaption.value.trim(),
    summary: elements.moderatorSummary.value.trim(),
    moderatorNote: elements.moderatorNote.value.trim(),
    sourcePdf: sessionFile?.name || existingDraft?.sourcePdf || "",
    sourceFileSize: sessionFile ? formatBytes(sessionFile.size) : existingDraft?.sourceFileSize || "",
    updatedAt: new Date().toLocaleString()
  };

  const isMeaningful =
    draft.caption !== (baseRegion?.caption || "") ||
    draft.summary !== (baseRegion?.summary || "") ||
    Boolean(draft.moderatorNote) ||
    Boolean(draft.sourcePdf);

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
    exportedAt: new Date().toISOString(),
    instructions: [
      "Give this JSON together with the original region PDFs to the associate finishing the atlas.",
      "Run python tools/apply_moderator_handoff.py moderator-handoff.json to integrate the draft text into the project.",
      "Run python tools/extract_maps.py on the PDFs, rename the desired JPGs to match the region map paths, then rebuild with python tools/build.py."
    ],
    drafts
  };

  const fileName = `atlas-moderator-handoff-${new Date().toISOString().slice(0, 10)}.json`;
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
    const importedMap = buildDraftMap(Array.isArray(drafts) ? drafts : []);

    if (!importedMap.size) {
      setModeratorStatus("The selected handoff file did not contain any valid region drafts.", true);
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
  if (state.currentScene !== "moderator") {
    state.returnScene = state.currentScene;
  }

  showScene("moderator");
  populateModeratorForm(regionId);
  buildModeratorDraftList();
}

function closeModerator() {
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
  elements.btnBegin.addEventListener("click", beginAtlas);
  elements.btnContents.addEventListener("click", () => {
    if (state.currentScene === "contents") {
      closeContents();
      return;
    }

    openContents();
  });
  elements.btnModerator.addEventListener("click", () => {
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

  elements.moderatorPdf.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const regionId = elements.moderatorRegion.value;

    revokeModeratorPdf(regionId);

    if (!file) {
      populateModeratorForm(regionId);
      return;
    }

    const pdfUrl = URL.createObjectURL(file);
    state.moderatorPdfUrls.set(regionId, pdfUrl);
    state.moderatorSessionFiles.set(regionId, file);
    elements.moderatorFileMeta.textContent = `Current session PDF: ${file.name} · ${formatBytes(file.size)}`;
    updateModeratorPdfPreview(regionId);
    updateModeratorCommand(regionId);
    setModeratorStatus(`Attached ${file.name}. Save the draft to record it in the handoff package.`);
  });

  elements.moderatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveModeratorDraft();
  });

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
      } else if (event.key.toLowerCase() === "m") {
        openModerator();
      }

      return;
    }

    if (state.currentScene === "contents") {
      if (event.key === "Escape") {
        closeContents();
      } else if (event.key.toLowerCase() === "m") {
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
    } else if (event.key.toLowerCase() === "m") {
      openModerator();
    } else if (event.key.toLowerCase() === "f") {
      toggleFullscreen();
    }
  });

  window.addEventListener("resize", fitImage);
  wireViewportInteractions();
}

if (REGIONS.length) {
  updateOverview();
  populateModeratorRegionOptions();
  populateModeratorForm(state.moderatorRegionId || REGIONS[0].id);
  buildFilmstrip();
  buildContents();
  buildModeratorDraftList();
  syncFullscreenLabel();
  wireEvents();
}
