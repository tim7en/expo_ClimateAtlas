const state = {
  query: "",
  activeRegionId: window.REGIONS?.[0]?.id ?? null,
  autoplayEnabled: false,
  rotationId: null
};

const elements = {
  search: document.querySelector("#region-search"),
  count: document.querySelector("#result-count"),
  list: document.querySelector("#region-list"),
  name: document.querySelector("#region-name"),
  index: document.querySelector("#region-index"),
  caption: document.querySelector("#region-caption"),
  themePills: document.querySelector("#theme-pills"),
  summary: document.querySelector("#region-summary"),
  factsGrid: document.querySelector("#facts-grid"),
  highlights: document.querySelector("#highlights-list"),
  mapStage: document.querySelector("#map-stage"),
  mapImage: document.querySelector("#map-image"),
  mapPlaceholder: document.querySelector("#map-placeholder"),
  placeholderTitle: document.querySelector("#placeholder-title"),
  placeholderCopy: document.querySelector("#placeholder-copy"),
  mapNote: document.querySelector("#map-note"),
  autoplayToggle: document.querySelector("#autoplay-toggle"),
  nextButton: document.querySelector("#next-region")
};

function getVisibleRegions() {
  const query = state.query.trim().toLowerCase();

  if (!query) {
    return window.REGIONS;
  }

  return window.REGIONS.filter((region) => {
    const haystack = [
      region.name,
      region.caption,
      region.summary,
      ...(region.themes || []),
      ...(region.highlights || [])
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function ensureActiveRegion(visibleRegions) {
  if (!visibleRegions.length) {
    state.activeRegionId = null;
    return null;
  }

  const activeRegion = visibleRegions.find((region) => region.id === state.activeRegionId);

  if (activeRegion) {
    return activeRegion;
  }

  state.activeRegionId = visibleRegions[0].id;
  return visibleRegions[0];
}

function setTheme(region) {
  const [accentA, accentB, accentC] = region.palette;
  document.documentElement.style.setProperty("--accent-a", accentA);
  document.documentElement.style.setProperty("--accent-b", accentB);
  document.documentElement.style.setProperty("--accent-c", accentC || accentB);
}

function renderRegionList(visibleRegions, activeRegion) {
  elements.count.textContent = `${visibleRegions.length} visible`;

  if (!visibleRegions.length) {
    elements.list.innerHTML = '<div class="empty-state">No regions match this search. Clear the filter or add broader theme keywords in js/regions.js.</div>';
    return;
  }

  elements.list.innerHTML = visibleRegions
    .map((region, index) => {
      const activeClass = region.id === activeRegion?.id ? " is-active" : "";
      return `
        <button class="region-button${activeClass}" type="button" data-region-id="${region.id}">
          <strong>${String(index + 1).padStart(2, "0")} · ${region.name}</strong>
          <span>${region.caption}</span>
        </button>
      `;
    })
    .join("");
}

function renderThemePills(region) {
  elements.themePills.innerHTML = (region.themes || []).map((theme) => `<span>${theme}</span>`).join("");
}

function renderFacts(region) {
  elements.factsGrid.innerHTML = (region.facts || [])
    .map(
      (fact) => `
        <dl class="fact-card">
          <dt>${fact.label}</dt>
          <dd>${fact.value}</dd>
        </dl>
      `
    )
    .join("");
}

function renderHighlights(region) {
  elements.highlights.innerHTML = (region.highlights || [])
    .map((highlight) => `<li>${highlight}</li>`)
    .join("");
}

function renderMap(region) {
  elements.mapNote.textContent = `Expected file: ${region.map}`;
  elements.placeholderTitle.textContent = `Add ${region.name} map`;
  elements.placeholderCopy.textContent = `Drop a curated JPG into ${region.map} or adjust the path in js/regions.js.`;
  elements.mapImage.hidden = true;
  elements.mapPlaceholder.hidden = false;
  elements.mapStage.dataset.ready = "false";
  elements.mapImage.removeAttribute("src");

  if (!region.map) {
    return;
  }

  const preview = new Image();
  preview.onload = () => {
    elements.mapImage.src = region.map;
    elements.mapImage.alt = `${region.name} atlas map`;
    elements.mapImage.hidden = false;
    elements.mapPlaceholder.hidden = true;
    elements.mapStage.dataset.ready = "true";
  };
  preview.onerror = () => {
    elements.mapStage.dataset.ready = "false";
  };
  preview.src = region.map;
}

function renderActiveRegion(region, visibleRegions) {
  if (!region) {
    elements.index.textContent = "No result";
    elements.name.textContent = "No matching region";
    elements.caption.textContent = "Try a broader search term.";
    elements.summary.textContent = "The atlas data is driven by js/regions.js, so you can expand search coverage by adding theme words there.";
    elements.themePills.innerHTML = "";
    elements.factsGrid.innerHTML = "";
    elements.highlights.innerHTML = "";
    elements.mapNote.textContent = "";
    elements.placeholderTitle.textContent = "No matching map";
    elements.placeholderCopy.textContent = "Clear the search field to restore the full atlas index.";
    elements.mapImage.hidden = true;
    elements.mapPlaceholder.hidden = false;
    elements.mapStage.dataset.ready = "false";
    return;
  }

  const activeIndex = visibleRegions.findIndex((item) => item.id === region.id);
  elements.index.textContent = `Region ${String(activeIndex + 1).padStart(2, "0")}`;
  elements.name.textContent = region.name;
  elements.caption.textContent = region.caption;
  elements.summary.textContent = region.summary;

  setTheme(region);
  renderThemePills(region);
  renderFacts(region);
  renderHighlights(region);
  renderMap(region);
}

function render() {
  const visibleRegions = getVisibleRegions();
  const activeRegion = ensureActiveRegion(visibleRegions);
  renderRegionList(visibleRegions, activeRegion);
  renderActiveRegion(activeRegion, visibleRegions);
}

function clearRotation() {
  if (state.rotationId) {
    window.clearInterval(state.rotationId);
    state.rotationId = null;
  }
}

function syncRotation() {
  clearRotation();

  if (state.autoplayEnabled && !document.hidden) {
    state.rotationId = window.setInterval(() => {
      stepRegion(1);
    }, 9000);
  }

  elements.autoplayToggle.textContent = state.autoplayEnabled ? "Stop autoplay" : "Start autoplay";
}

function stepRegion(direction) {
  const visibleRegions = getVisibleRegions();

  if (!visibleRegions.length) {
    return;
  }

  const activeIndex = visibleRegions.findIndex((region) => region.id === state.activeRegionId);
  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  const nextIndex = (currentIndex + direction + visibleRegions.length) % visibleRegions.length;
  state.activeRegionId = visibleRegions[nextIndex].id;
  render();
}

function wireEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  elements.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-region-id]");

    if (!button) {
      return;
    }

    state.activeRegionId = button.dataset.regionId;
    render();
  });

  elements.autoplayToggle.addEventListener("click", () => {
    state.autoplayEnabled = !state.autoplayEnabled;
    syncRotation();
  });

  elements.nextButton.addEventListener("click", () => {
    stepRegion(1);
  });

  document.addEventListener("visibilitychange", () => {
    syncRotation();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

    if (isTyping) {
      return;
    }

    if (event.key === "ArrowRight") {
      stepRegion(1);
    }

    if (event.key === "ArrowLeft") {
      stepRegion(-1);
    }

    if (event.key.toLowerCase() === " ") {
      event.preventDefault();
      state.autoplayEnabled = !state.autoplayEnabled;
      syncRotation();
    }
  });
}

wireEvents();
render();
syncRotation();
