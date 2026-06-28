import { splitDisplayPath } from "@collab/shared/path-utils";

const TILE_GAP = 6;

/**
 * Turns arbitrary input into a navigable URL.
 * If the input looks like a URL (has a scheme or a recognized TLD),
 * return it (prepending https:// when needed). Otherwise treat it as
 * a Google search query.
 */
function resolveInput(raw) {
  const s = raw.trim();
  if (!s) return "";

  // Already has a scheme
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;

  // Looks like a domain (with TLD), optionally followed by path/query
  if (/^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return `https://${s}`;

  // Anything else → Google search
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`;
}

/** Darken (amount<0) or lighten (amount>0) a hex color by a 0..1 ratio. */
function shade(hex, amount) {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const adjust = (v) => {
    const n = Math.round(v + (amount < 0 ? v * amount : (255 - v) * amount));
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  };
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `#${adjust(r)}${adjust(g)}${adjust(b)}`;
}

/**
 * Sticky note palette keyed by paper (body) color. Each entry pins the exact
 * header strip and foreground text. Unknown colors fall back to derivation.
 */
export const STICKY_PALETTE = {
  "#fef8c4": { header: "#f0eab8", text: "#5c4036" },
  "#f8bad0": { header: "#e8b0c4", text: "#880e4e" },
  "#badefa": { header: "#b0d0ec", text: "#0c46a0" },
  "#c8e6c8": { header: "#bcd8bc", text: "#1a5e20" },
  "#fee0b2": { header: "#f0d2a6", text: "#e44400" },
  "#e0bee6": { header: "#d2b2d8", text: "#4a148c" },
  "#2c2c2c": { header: "#424242", text: "#fefefe" },
  "#36464e": { header: "#4a5860", text: "#fefefe" },
};

/** Pick black or white text for legibility on a given hex background. */
function contrastColor(hex) {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000000" : "#ffffff";
}

/**
 * Apply (or clear) a tile's user-chosen accent color to its title bar + border.
 * @param {object} dom
 * @param {import('./canvas-state.js').Tile} tile
 */
export function applyTileColor(dom, tile) {
  const color = tile.color;
  if (tile.sticky) {
    const body = color || "#fef8c4";
    const p = STICKY_PALETTE[body.toLowerCase()];
    const header = p ? p.header : shade(body, -0.06);
    dom.container.style.background = body;
    dom.container.style.borderColor = p ? p.header : shade(body, -0.12);
    dom.titleBar.style.background = header;
    dom.titleBar.style.color = p ? p.text : contrastColor(body);
    return;
  }
  if (!color) {
    dom.titleBar.style.background = "";
    dom.titleBar.style.color = "";
    dom.container.style.borderColor = "";
    return;
  }
  dom.titleBar.style.background = color;
  dom.titleBar.style.color = contrastColor(color);
  dom.container.style.borderColor = color;
}

/**
 * Open the native color picker, seeded with `initial`. Calls onPick live while
 * dragging and once more on commit. The input lives offscreen and is removed
 * after the dialog closes.
 */
export function pickColor(initial, onPick) {
  const input = document.createElement("input");
  input.type = "color";
  input.value = initial || "#3b82f6";
  input.style.position = "fixed";
  input.style.left = "8px";
  input.style.bottom = "8px";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  document.body.appendChild(input);
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    input.remove();
  };
  input.addEventListener("input", () => onPick(input.value));
  input.addEventListener("change", () => {
    onPick(input.value);
    cleanup();
  });
  input.addEventListener("blur", () => setTimeout(cleanup, 150));
  input.click();
}

/**
 * Creates the DOM structure for a tile.
 * @param {import('./canvas-state.js').Tile} tile
 * @param {object} callbacks
 * @param {(id: string) => void} callbacks.onClose
 * @param {(id: string, e?: MouseEvent) => void} callbacks.onFocus
 * @param {((id: string, url: string) => void)|null} [callbacks.onNavigate]
 * @param {((id: string) => void)|null} [callbacks.onRename]
 * @param {((id: string) => void)|null} [callbacks.onDuplicate]
 * @param {((id: string) => void)|null} [callbacks.onToggleFullscreen]
 */
export function createTileDOM(tile, callbacks) {
  const container = document.createElement("div");
  container.className = "canvas-tile";
  container.dataset.tileId = tile.id;
  container.dataset.tileType = tile.type;
  if (tile.sticky) container.classList.add("sticky-note");

  const titleBar = document.createElement("div");
  titleBar.className = "tile-title-bar";

  const titleText = document.createElement("span");
  titleText.className = "tile-title-text";
  const label = getTileLabel(tile);
  const parentSpan = document.createElement("span");
  parentSpan.className = "tile-title-parent";
  parentSpan.textContent = label.parent;
  const nameSpan = document.createElement("span");
  nameSpan.className = "tile-title-name";
  nameSpan.textContent = label.name;
  titleText.appendChild(parentSpan);
  titleText.appendChild(nameSpan);
  if (tile.filePath) titleText.title = tile.filePath;
  if (tile.folderPath) titleText.title = tile.folderPath;
  const titleGroup = document.createElement("div");
  titleGroup.className = "tile-title-group";
  titleGroup.appendChild(titleText);
  titleBar.appendChild(titleGroup);

  // For browser tiles, add nav controls and a URL input to the title bar
  let urlInput;
  let navBack;
  let navForward;
  let navReload;
  if (tile.type === "browser") {
    const navGroup = document.createElement("div");
    navGroup.className = "tile-nav-group";

    navBack = document.createElement("button");
    navBack.className = "tile-nav-btn";
    navBack.title = "Back";
    navBack.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>`;
    navBack.disabled = true;
    navBack.addEventListener("mousedown", (e) => e.stopPropagation());

    navForward = document.createElement("button");
    navForward.className = "tile-nav-btn";
    navForward.title = "Forward";
    navForward.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>`;
    navForward.disabled = true;
    navForward.addEventListener("mousedown", (e) => e.stopPropagation());

    navReload = document.createElement("button");
    navReload.className = "tile-nav-btn";
    navReload.title = "Reload";
    navReload.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3v4h-4"/><path d="M12.36 10a5 5 0 1 1-.96-5.36L13 7"/></svg>`;
    navReload.addEventListener("mousedown", (e) => e.stopPropagation());

    navGroup.appendChild(navBack);
    navGroup.appendChild(navForward);
    navGroup.appendChild(navReload);
    titleBar.appendChild(navGroup);
    urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.className = "tile-url-input";
    urlInput.placeholder = "Search or enter URL...";
    urlInput.value = tile.url || "";
    if (tile.url) urlInput.readOnly = true;
    let dragOccurred = false;
    urlInput.addEventListener("mousedown", (e) => {
      dragOccurred = false;
      if (urlInput.readOnly) return;
      e.stopPropagation();
    });
    urlInput.addEventListener("mousemove", () => {
      dragOccurred = true;
    });
    urlInput.addEventListener("click", () => {
      if (urlInput.readOnly && !dragOccurred) {
        urlInput.readOnly = false;
        urlInput.select();
      }
    });
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const url = resolveInput(urlInput.value);
        if (url && callbacks.onNavigate) callbacks.onNavigate(tile.id, url);
        urlInput.readOnly = true;
        urlInput.blur();
      }
      if (e.key === "Escape") {
        urlInput.value = tile.url || "";
        urlInput.readOnly = true;
        urlInput.blur();
      }
    });
    urlInput.addEventListener("blur", () => {
      if (!urlInput.readOnly) {
        urlInput.value = tile.url || "";
        urlInput.readOnly = true;
      }
      window.getSelection()?.removeAllRanges();
    });
    titleText.style.display = "none";
  }

  const btnGroup = document.createElement("div");
  btnGroup.className = "tile-btn-group";

  const copyablePath = tile.filePath || tile.folderPath;
  if (copyablePath) {
    const copySvg = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 0 1 2 9.5V3.5A1.5 1.5 0 0 1 3.5 2h6A1.5 1.5 0 0 1 11 3.5V5"/></svg>`;
    const checkSvg = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 6.5 12 13 4"/></svg>`;
    const copyBtn = document.createElement("button");
    copyBtn.className = "tile-action-btn tile-copy-path-btn";
    copyBtn.innerHTML = copySvg;
    copyBtn.title = "Copy path";
    copyBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(copyablePath);
      copyBtn.innerHTML = checkSvg;
      setTimeout(() => { copyBtn.innerHTML = copySvg; }, 1000);
    });
    titleGroup.appendChild(copyBtn);
  }

  if (callbacks.onToggleFullscreen) {
    const fsBtn = document.createElement("button");
    fsBtn.className = "tile-action-btn tile-fullscreen-btn";
    fsBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 1 1 1 1 4"/><polyline points="12 1 15 1 15 4"/><polyline points="4 15 1 15 1 12"/><polyline points="12 15 15 15 15 12"/></svg>`;
    fsBtn.title = "Fullscreen";
    fsBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    fsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onToggleFullscreen(tile.id);
    });
    btnGroup.appendChild(fsBtn);
  }

  if (tile.type === "term" && callbacks.onRestart) {
    const restartBtn = document.createElement("button");
    restartBtn.className = "tile-action-btn tile-restart-btn";
    restartBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3v4h-4"/><path d="M12.36 10a5 5 0 1 1-.96-5.36L13 7"/></svg>`;
    restartBtn.title = "Restart terminal";
    restartBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    restartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onRestart(tile.id);
    });
    btnGroup.appendChild(restartBtn);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "tile-action-btn tile-close-btn";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close tile";
  closeBtn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    callbacks.onClose(tile.id);
  });
  btnGroup.appendChild(closeBtn);
  titleBar.appendChild(btnGroup);

  if (tile.type === "term") {
    titleBar.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selected = await window.shellApi.showContextMenu([
        { id: "rename", label: "Rename" },
        { id: "duplicate", label: "Duplicate" },
        { id: "separator", label: "" },
        { id: "set-color", label: "Set Color…" },
        ...(tile.color
          ? [{ id: "reset-color", label: "Reset Color" }]
          : []),
      ]);
      if (selected === "rename" && callbacks.onRename) {
        callbacks.onRename(tile.id);
      } else if (selected === "duplicate" && callbacks.onDuplicate) {
        callbacks.onDuplicate(tile.id);
      } else if (selected === "set-color" && callbacks.onSetColor) {
        pickColor(tile.color, (color) =>
          callbacks.onSetColor(tile.id, color),
        );
      } else if (selected === "reset-color" && callbacks.onResetColor) {
        callbacks.onResetColor(tile.id);
      }
    });
  }

  const contentArea = document.createElement("div");
  contentArea.className = "tile-content";

  const contentOverlay = document.createElement("div");
  contentOverlay.className = "tile-content-overlay";

  if (urlInput) titleBar.insertBefore(urlInput, btnGroup);

  container.appendChild(titleBar);
  container.appendChild(contentArea);
  contentArea.appendChild(contentOverlay);

  const dom = { container, titleBar, titleText, contentArea, contentOverlay, closeBtn, urlInput, navBack, navForward, navReload };
  applyTileColor(dom, tile);
  return dom;
}

export function getTileLabel(tile) {
  if (tile.type === "term") {
    if (tile.userTitle) return { parent: "", name: tile.userTitle };
    if (tile.autoTitle) return splitFilepath(tile.autoTitle);
    if (tile.cwd) return splitFilepath(tile.cwd);
    return { parent: "", name: "Terminal" };
  }
  if (tile.type === "browser") {
    if (tile.url) {
      try { return { parent: "", name: new URL(tile.url).hostname }; }
      catch { return { parent: "", name: tile.url }; }
    }
    return { parent: "", name: "Browser" };
  }
  if (tile.type === "graph") {
    if (tile.folderPath) return splitFilepath(tile.folderPath);
    return { parent: "", name: "Graph" };
  }
  if (tile.type === "docker") {
    return { parent: "", name: "Containers" };
  }
  if (tile.type === "vscode") {
    if (tile.folderPath) {
      const { name } = splitFilepath(tile.folderPath);
      return { parent: "VS Code · ", name: name || "VS Code" };
    }
    return { parent: "", name: "VS Code" };
  }
  if (tile.filePath) return splitFilepath(tile.filePath);
  return { parent: "", name: tile.type };
}

export function splitFilepath(path) {
  return splitDisplayPath(path);
}

export function updateTileTitle(dom, tile) {
  const label = getTileLabel(tile);
  const titleText = dom.titleText;
  titleText.textContent = "";
  const parentSpan = document.createElement("span");
  parentSpan.className = "tile-title-parent";
  parentSpan.textContent = label.parent;
  const nameSpan = document.createElement("span");
  nameSpan.className = "tile-title-name";
  nameSpan.textContent = label.name;
  titleText.appendChild(parentSpan);
  titleText.appendChild(nameSpan);
  titleText.title = tile.filePath || tile.folderPath || tile.cwd || "";
}

export function startInlineRename(dom, tile, onCommit) {
  const existing = dom.titleText.parentNode.querySelector(".tile-rename-input");
  if (existing) return;
  const titleText = dom.titleText;
  const currentLabel = getTileLabel(tile);
  const currentName = currentLabel.parent
    ? currentLabel.parent + currentLabel.name
    : currentLabel.name;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "tile-rename-input";
  input.value = tile.userTitle ?? currentName;
  titleText.style.display = "none";
  titleText.parentNode.insertBefore(input, titleText);
  input.select();
  input.focus();

  let committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    const value = input.value.trim();
    input.remove();
    titleText.style.display = "";
    onCommit(value);
  }

  function cancel() {
    if (committed) return;
    committed = true;
    input.remove();
    titleText.style.display = "";
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
    e.stopPropagation();
  });
  input.addEventListener("blur", () => commit());
  input.addEventListener("mousedown", (e) => e.stopPropagation());
}

/**
 * Positions a tile container in screen coordinates.
 * @param {HTMLElement} container
 * @param {import('./canvas-state.js').Tile} tile
 * @param {number} panX
 * @param {number} panY
 * @param {number} zoom
 */
export function positionTile(container, tile, panX, panY, zoom) {
  if (container.classList.contains("tile-fullscreen")) return;

  const inset = TILE_GAP / 2;
  const sx = (tile.x + inset) * zoom + panX;
  const sy = (tile.y + inset) * zoom + panY;

  container.style.left = `${sx}px`;
  container.style.top = `${sy}px`;
  container.style.width = `${Math.max(0, tile.width - TILE_GAP)}px`;
  container.style.height = `${Math.max(0, tile.height - TILE_GAP)}px`;
  container.style.transform = `scale(${zoom})`;
  container.style.transformOrigin = "top left";
  container.style.zIndex = String(tile.zIndex);
}

/**
 * Positions all tile containers.
 * @param {Map<string, {container: HTMLElement}>} tileDOMs
 * @param {import('./canvas-state.js').Tile[]} tiles
 * @param {number} panX
 * @param {number} panY
 * @param {number} zoom
 */
export function positionAllTiles(tileDOMs, tiles, panX, panY, zoom) {
  for (const tile of tiles) {
    const dom = tileDOMs.get(tile.id);
    if (dom) positionTile(dom.container, tile, panX, panY, zoom);
  }
}
