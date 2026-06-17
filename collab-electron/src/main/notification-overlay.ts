import { BrowserWindow, ipcMain, nativeTheme, screen } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app } from "electron";

let overlayWin: BrowserWindow | null = null;
let mainWin: BrowserWindow | null = null;
let focusedTileId: string | null = null;
let notifCounter = 0;
let overlayReady = false;

interface PendingNotification {
  id: string;
  title: string;
  body: string;
  tileId: string | null;
  cwd: string | null;
}

const pendingQueue: PendingNotification[] = [];

function getPreloadPath(name: string): string {
  return join(__dirname, `../preload/${name}.js`);
}

function getRendererURL(name: string): string {
  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    return `${process.env["ELECTRON_RENDERER_URL"]}/${name}/index.html`;
  }
  return pathToFileURL(
    join(__dirname, `../renderer/${name}/index.html`),
  ).href;
}

function createOverlayWindow(): BrowserWindow {
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.workArea;
  const winW = 420;
  const winH = 520;
  const margin = 16;

  const win = new BrowserWindow({
    width: winW,
    height: winH,
    x: x + width - winW - margin,
    y: y + height - winH - margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath("notification-overlay"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.setContentProtection(true);

  const url = getRendererURL("notification-overlay");
  win.loadURL(url);

  win.webContents.on("did-finish-load", () => {
    overlayReady = true;
    win.webContents.send("notif:theme", nativeTheme.shouldUseDarkColors);
    win.showInactive();
    flushPendingQueue();
  });

  win.webContents.on(
    "did-fail-load",
    (_event, code, desc) => {
      console.error(
        "[notification-overlay] load failed:", code, desc,
      );
    },
  );

  return win;
}

function flushPendingQueue(): void {
  if (!overlayWin || overlayWin.isDestroyed() || !overlayReady) return;
  while (pendingQueue.length > 0) {
    const notif = pendingQueue.shift()!;
    overlayWin.webContents.send("notif:show", notif);
  }
}

function ensureOverlay(): BrowserWindow | null {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;
  if (!mainWin || mainWin.isDestroyed()) return null;
  overlayReady = false;
  overlayWin = createOverlayWindow();

  overlayWin.on("closed", () => {
    overlayWin = null;
    overlayReady = false;
  });

  return overlayWin;
}

export function initNotificationOverlay(main: BrowserWindow): void {
  mainWin = main;

  ipcMain.on(
    "notif:clicked",
    (
      _event,
      data: { tileId: string | null; cwd: string | null },
    ) => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.show();
        mainWin.focus();
        if (data?.tileId || data?.cwd) {
          mainWin.webContents.send(
            "shell:notification-navigate",
            data,
          );
        }
      }
    },
  );

  ipcMain.on("shell:tile-focused", (_event, tileId: string | null) => {
    focusedTileId = tileId;
  });

  nativeTheme.on("updated", () => {
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send(
        "notif:theme",
        nativeTheme.shouldUseDarkColors,
      );
    }
  });

  main.on("closed", () => {
    mainWin = null;
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.close();
    }
  });
}

export function showOverlayNotification(opts: {
  title: string;
  body: string;
  tileId?: string | null;
  cwd?: string | null;
}): void {
  const tileId = opts.tileId ?? null;
  const cwd = opts.cwd ?? null;

  if (tileId && tileId === focusedTileId) return;

  const win = ensureOverlay();
  if (!win) return;

  const notif: PendingNotification = {
    id: `notif-${++notifCounter}`,
    title: opts.title,
    body: opts.body,
    tileId,
    cwd,
  };

  if (overlayReady) {
    win.webContents.send("notif:show", notif);
  } else {
    pendingQueue.push(notif);
  }

  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(
      "shell:notification-badge",
      { tileId, cwd },
    );
  }
}

export function setFocusedTileId(id: string | null): void {
  focusedTileId = id;
}

export function dismissOverlayByTileId(tileId: string): void {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send("notif:dismiss", { tileId });
  }
}
