import { useCallback, useEffect, useRef, useState } from "react";
import {
  GearSix,
  Keyboard,
  Palette,
  PuzzlePiece,
  Sun,
  Moon,
  Monitor,
  Terminal,
} from "@phosphor-icons/react";

type ThemeMode = "light" | "dark" | "system";

interface Binding {
  code: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
}

interface EffectiveBinding {
  action: string;
  label: string;
  binding: Binding | null;
  isDefault: boolean;
}

interface SettingsApi {
  getPref: (key: string) => Promise<unknown>;
  setPref: (key: string, value: unknown) => Promise<void>;
  getKeybindings: () => Promise<EffectiveBinding[]>;
  setKeybinding: (
    action: string,
    binding: Binding | null,
  ) => Promise<EffectiveBinding[]>;
  resetKeybindings: (action: string | null) => Promise<EffectiveBinding[]>;
  setNativeContext: (
    enabled: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  listTerminalTargets: () => Promise<Array<{
    id: string;
    label: string;
    isDefault?: boolean;
  }>>;
  setTheme: (mode: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  getAgents: () => Promise<AgentStatus[]>;
  installSkill: (agentId: string) => Promise<{ ok: boolean }>;
  uninstallSkill: (agentId: string) => Promise<{ ok: boolean }>;
  close: () => void;
}

const api = (window as unknown as { api: SettingsApi }).api;

const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pct = ((value - min) / (max - min)) * 100;

  const commit = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      onChange(Math.min(max, Math.round(raw / step) * step));
    },
    [min, max, step, onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      commit(e.clientX);
    },
    [commit],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      commit(e.clientX);
    },
    [commit],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative h-5 w-full cursor-pointer select-none flex items-center"
    >
      <div
        className="absolute h-[3px] w-full rounded-full"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--foreground) 12%, transparent)",
        }}
      />
      <div
        className="absolute h-[3px] rounded-full"
        style={{
          width: `${pct}%`,
          backgroundColor: "var(--foreground)",
          opacity: 0.45,
        }}
      />
      <div
        className="absolute h-3.5 w-3.5 rounded-full border-2 shadow-sm"
        style={{
          left: `calc(${pct}% - 7px)`,
          backgroundColor: "var(--background)",
          borderColor: "var(--foreground)",
          opacity: 1,
        }}
      />
    </div>
  );
}

function ThemeToggle({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const idx = THEME_MODES.indexOf(value);

  return (
    <div
      className="relative inline-flex h-8 rounded-full p-0.5"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--foreground) 10%, transparent)",
      }}
    >
      {/* sliding pill */}
      <div
        className="absolute top-0.5 h-7 w-9 rounded-full transition-transform duration-150"
        style={{
          backgroundColor: "var(--accent)",
          transform: `translateX(${idx * 36}px)`,
        }}
      />
      {THEME_MODES.map((mode) => {
        const Icon = THEME_ICONS[mode];
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            aria-label={mode}
            onClick={() => onChange(mode)}
            className="relative z-10 flex h-7 w-9 items-center justify-center rounded-full cursor-pointer"
          >
            <Icon
              className="h-4 w-4 transition-colors duration-150"
              style={{
                color: active
                  ? "var(--foreground)"
                  : "var(--muted-foreground)",
              }}
              weight={active ? "fill" : "regular"}
            />
          </button>
        );
      })}
    </div>
  );
}

function AppearancePane() {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [canvasOpacity, setCanvasOpacity] = useState(0);
  const [maxZoom, setMaxZoom] = useState(100);

  useEffect(() => {
    api.getPref("theme")
      .then((v) => {
        if (v === "light" || v === "dark") setTheme(v);
        else setTheme("system");
      })
      .catch(() => { });
    api.getPref("canvasOpacity")
      .then((v) => {
        if (typeof v === "number") setCanvasOpacity(v);
      })
      .catch(() => { });
    api.getPref("maxZoom")
      .then((v) => {
        if (typeof v === "number") setMaxZoom(Math.round(v * 100));
      })
      .catch(() => { });
  }, []);

  async function handleThemeChange(mode: ThemeMode) {
    setTheme(mode);
    await api.setTheme(mode);
  }

  async function handleOpacityChange(value: number) {
    setCanvasOpacity(value);
    await api.setPref("canvasOpacity", value);
  }

  async function handleMaxZoomChange(value: number) {
    setMaxZoom(value);
    await api.setPref("maxZoom", value / 100);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize how Collaborator looks.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Theme</p>
        <ThemeToggle
          value={theme}
          onChange={(m) => { void handleThemeChange(m); }}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Canvas opacity</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {canvasOpacity}%
          </span>
        </div>
        <Slider
          value={canvasOpacity}
          onChange={(v) => { void handleOpacityChange(v); }}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Maximum zoom</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {maxZoom}%
          </span>
        </div>
        <Slider
          value={maxZoom}
          min={100}
          max={125}
          step={5}
          onChange={(v) => { void handleMaxZoomChange(v); }}
        />
        <p className="text-xs text-muted-foreground">
          Above 100% terminal text may look blurry.
        </p>
      </div>
    </div>
  );
}

const IS_MAC = window.api.getPlatform() === "darwin";

const MOD = IS_MAC ? "\u2318" : "Ctrl+";

const FIXED_SHORTCUTS: { label: string; keys: string }[] = [
  { label: "Zoom In", keys: `${MOD} =` },
  { label: "Zoom Out", keys: `${MOD} -` },
  { label: "Actual Size", keys: `${MOD} 0` },
  {
    label: "Toggle Full Screen",
    keys: IS_MAC ? "\u2303 \u2318 F" : "F11",
  },
];

const FIXED_MOUSE: { label: string; keys: string }[] = [
  { label: "Pan Canvas", keys: "Two-Finger Swipe" },
  { label: "Pan Canvas", keys: "Middle Click + Drag" },
  { label: "Pan Canvas", keys: "Space + Drag" },
];

type ModName = "ctrl" | "shift" | "alt" | "meta";

const MOD_SYMBOLS: Record<ModName, string> = {
  meta: IS_MAC ? "\u2318" : "Win+",
  ctrl: IS_MAC ? "\u2303" : "Ctrl+",
  alt: IS_MAC ? "\u2325" : "Alt+",
  shift: IS_MAC ? "\u21E7" : "Shift+",
};

const MOUSE_MOD_OPTIONS: { value: ModName; label: string }[] = [
  { value: "ctrl", label: IS_MAC ? "\u2303 Control" : "Ctrl" },
  { value: "shift", label: IS_MAC ? "\u21E7 Shift" : "Shift" },
  { value: "alt", label: IS_MAC ? "\u2325 Option" : "Alt" },
  { value: "meta", label: IS_MAC ? "\u2318 Command" : "Win" },
];

const CODE_LABELS: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  ArrowLeft: "\u2190",
  ArrowRight: "\u2192",
  ArrowUp: "\u2191",
  ArrowDown: "\u2193",
  Space: "Space",
  Enter: "\u23CE",
  Tab: "Tab",
};

function codeLabel(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code]!;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

function formatBinding(b: Binding | null): string {
  if (!b) return "Disabled";
  let prefix = "";
  if (b.meta) prefix += MOD_SYMBOLS.meta;
  if (b.ctrl) prefix += MOD_SYMBOLS.ctrl;
  if (b.alt) prefix += MOD_SYMBOLS.alt;
  if (b.shift) prefix += MOD_SYMBOLS.shift;
  return `${prefix}${codeLabel(b.code)}`;
}

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--foreground) 8%, transparent)",
        color: "var(--foreground)",
      }}
    >
      {children}
    </kbd>
  );
}

function ShortcutList({ items }: { items: { label: string; keys: string }[] }) {
  return (
    <div className="space-y-0">
      {items.map(({ label, keys }, i) => (
        <div
          key={`${label}-${i}`}
          className="flex items-center justify-between py-2"
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
          }}
        >
          <span className="text-sm">{label}</span>
          <Kbd>{keys}</Kbd>
        </div>
      ))}
    </div>
  );
}

function bindingFromEvent(e: KeyboardEvent): Binding {
  return {
    code: e.code,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    alt: e.altKey,
    shift: e.shiftKey,
  };
}

function KeybindingRow({
  item,
  capturing,
  onCapture,
  onReset,
  onDisable,
}: {
  item: EffectiveBinding;
  capturing: boolean;
  onCapture: () => void;
  onReset: () => void;
  onDisable: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{
        borderBottom:
          "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
      }}
    >
      <span className="text-sm">{item.label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCapture}
          className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-mono"
          style={{
            backgroundColor: capturing
              ? "var(--accent)"
              : "color-mix(in srgb, var(--foreground) 8%, transparent)",
            color: "var(--foreground)",
            minWidth: "3.5rem",
            textAlign: "center",
          }}
        >
          {capturing ? "Press keys…" : formatBinding(item.binding)}
        </button>
        {!item.isDefault && (
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset to default"
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        )}
        {item.binding && (
          <button
            type="button"
            onClick={onDisable}
            aria-label="Disable shortcut"
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function KeybindingEditor() {
  const [bindings, setBindings] = useState<EffectiveBinding[]>([]);
  const [capturing, setCapturing] = useState<string | null>(null);

  useEffect(() => {
    api.getKeybindings()
      .then((b) => setBindings(b))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      if (MODIFIER_CODES.has(e.code)) return;
      const action = capturing;
      setCapturing(null);
      api.setKeybinding(action, bindingFromEvent(e))
        .then((b) => setBindings(b))
        .catch(() => { });
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing]);

  function reset(action: string) {
    api.resetKeybindings(action)
      .then((b) => setBindings(b))
      .catch(() => { });
  }

  function disable(action: string) {
    api.setKeybinding(action, null)
      .then((b) => setBindings(b))
      .catch(() => { });
  }

  const conflicts = new Set<string>();
  const seen = new Map<string, string>();
  for (const b of bindings) {
    if (!b.binding) continue;
    const key = formatBinding(b.binding);
    if (seen.has(key)) {
      conflicts.add(b.action);
      conflicts.add(seen.get(key)!);
    } else {
      seen.set(key, b.action);
    }
  }

  return (
    <div>
      <div className="space-y-0">
        {bindings.map((item) => (
          <KeybindingRow
            key={item.action}
            item={item}
            capturing={capturing === item.action}
            onCapture={() =>
              setCapturing(capturing === item.action ? null : item.action)}
            onReset={() => reset(item.action)}
            onDisable={() => disable(item.action)}
          />
        ))}
      </div>
      {conflicts.size > 0 && (
        <p className="pt-2 text-xs" style={{ color: "#f59e0b" }}>
          Two shortcuts share the same keys — only one will fire.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          api.resetKeybindings(null)
            .then((b) => setBindings(b))
            .catch(() => { });
        }}
        className="mt-3 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
      >
        Reset all to defaults
      </button>
    </div>
  );
}

type ZoomMod = ModName | "none";

const OPTION_STYLE = {
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
};

interface MouseMods {
  vertical: ModName;
  horizontal: ModName;
  zoom: ZoomMod;
}

const DEFAULT_MOUSE_MODS: MouseMods = {
  vertical: "ctrl",
  horizontal: "shift",
  zoom: "none",
};

function ModSelect({
  value,
  onChange,
  allowNone,
}: {
  value: ZoomMod;
  onChange: (m: ZoomMod) => void;
  allowNone?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ZoomMod)}
      className="cursor-pointer rounded px-1.5 py-0.5 text-xs"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        border:
          "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)",
      }}
    >
      {allowNone && (
        <option value="none" style={OPTION_STYLE}>
          None
        </option>
      )}
      {MOUSE_MOD_OPTIONS.map((o) => (
        <option key={o.value} value={o.value} style={OPTION_STYLE}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function MouseModEditor() {
  const [mods, setMods] = useState<MouseMods>(DEFAULT_MOUSE_MODS);

  useEffect(() => {
    api.getPref("mouseMods")
      .then((v) => {
        if (v && typeof v === "object") {
          setMods({ ...DEFAULT_MOUSE_MODS, ...(v as Partial<MouseMods>) });
        }
      })
      .catch(() => { });
  }, []);

  function update(next: MouseMods) {
    setMods(next);
    void api.setPref("mouseMods", next);
  }

  return (
    <div className="space-y-0">
      <div
        className="flex items-center justify-between py-2"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      >
        <span className="text-sm">Zoom</span>
        <div className="flex items-center gap-1.5">
          <ModSelect
            value={mods.zoom}
            allowNone
            onChange={(m) => update({ ...mods, zoom: m })}
          />
          <Kbd>Scroll</Kbd>
        </div>
      </div>
      <div
        className="flex items-center justify-between py-2"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      >
        <span className="text-sm">Scroll Canvas Vertically</span>
        <div className="flex items-center gap-1.5">
          <ModSelect
            value={mods.vertical}
            onChange={(m) => update({ ...mods, vertical: m as ModName })}
          />
          <Kbd>Scroll</Kbd>
        </div>
      </div>
      <div
        className="flex items-center justify-between py-2"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      >
        <span className="text-sm">Scroll Canvas Horizontally</span>
        <div className="flex items-center gap-1.5">
          <ModSelect
            value={mods.horizontal}
            onChange={(m) => update({ ...mods, horizontal: m as ModName })}
          />
          <Kbd>Scroll</Kbd>
        </div>
      </div>
    </div>
  );
}

type TerminalMode = "tmux" | "sidecar";

const TERMINAL_MODES: {
  value: TerminalMode;
  label: string;
  description: string;
  deprecated?: boolean;
}[] = [
  {
    value: "sidecar",
    label: "node-pty",
    description: "Clean scrollback rendering.",
  },
  {
    value: "tmux",
    label: "tmux",
    description: "May cause scrollback artifacts.",
    deprecated: true,
  },
];

type TerminalTarget = string;

type TerminalTargetOption = {
  id: string;
  label: string;
  isDefault?: boolean;
};

function RadioOption({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left cursor-pointer"
      style={{
        border: `1px solid ${selected
          ? "var(--foreground)"
          : "color-mix(in srgb, var(--foreground) 15%, transparent)"}`,
        backgroundColor: selected
          ? "color-mix(in srgb, var(--foreground) 6%, transparent)"
          : "transparent",
      }}
    >
      <div
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: selected
            ? "var(--foreground)"
            : "var(--muted-foreground)",
        }}
      >
        {selected && (
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--foreground)" }}
          />
        )}
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function MacTerminalPane() {
  const [mode, setMode] = useState<TerminalMode>("sidecar");

  useEffect(() => {
    api.getPref("terminalMode")
      .then((v) => {
        if (v === "tmux" || v === "sidecar") setMode(v);
      })
      .catch(() => { });
  }, []);

  async function handleModeChange(value: TerminalMode) {
    setMode(value);
    await api.setPref("terminalMode", value);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Terminal</h2>
        <p className="text-sm text-muted-foreground">
          Changes take effect for new terminals.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Terminal backend</p>
        <div className="space-y-1.5">
          {TERMINAL_MODES.map(({ value, label, description, deprecated }) => (
            <RadioOption
              key={value}
              selected={mode === value}
              onClick={() => { void handleModeChange(value); }}
              label={label}
              description={
                deprecated
                  ? `${description} Deprecated — will be removed in a future release.`
                  : description
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WindowsTerminalPane() {
  const [target, setTarget] = useState<TerminalTarget>("auto");
  const [options, setOptions] = useState<TerminalTargetOption[]>([]);

  useEffect(() => {
    api.getPref("terminalTarget")
      .then((v) => {
        if (typeof v === "string") setTarget(v);
      })
      .catch(() => { });
    api.listTerminalTargets()
      .then((items) => setOptions(items))
      .catch(() => { });
  }, []);

  async function handleTargetChange(value: TerminalTarget) {
    setTarget(value);
    await api.setPref("terminalTarget", value);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Terminal</h2>
        <p className="text-sm text-muted-foreground">
          Changes take effect for new terminals.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Terminal target</p>
        <div className="space-y-1.5">
          {options.map(({ id, label, isDefault }) => (
            <RadioOption
              key={id}
              selected={target === id}
              onClick={() => { void handleTargetChange(id); }}
              label={label}
              description={isDefault
                ? "Recommended default for this platform."
                : "Available for new terminals."}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer"
      style={{
        backgroundColor: checked
          ? "var(--accent)"
          : "color-mix(in srgb, var(--foreground) 18%, transparent)",
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full transition-transform"
        style={{
          backgroundColor: "var(--background)",
          transform: `translateX(${checked ? 18 : 2}px)`,
        }}
      />
    </button>
  );
}

function NativeContextSection() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPref("nativeContextProbe")
      .then((v) => setEnabled(v === true))
      .catch(() => {});
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setEnabled(next);
    try {
      const result = await api.setNativeContext(next);
      if (!result.ok) {
        setError(result.error ?? "Failed to update Claude settings");
        setEnabled(!next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEnabled(!next);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3 px-6 pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Native context detection</p>
          <p className="text-xs text-muted-foreground">
            Registers a Claude Code statusline to read exact model and context
            window usage. Chains to an existing statusline if present. Restart
            Claude Code sessions after enabling.
          </p>
        </div>
        <div className={busy ? "opacity-50 pointer-events-none" : ""}>
          <Switch checked={enabled} onChange={(n) => { void toggle(n); }} />
        </div>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
      )}
    </div>
  );
}

function TerminalPane() {
  return (
    <>
      {IS_MAC ? <MacTerminalPane /> : <WindowsTerminalPane />}
      <NativeContextSection />
    </>
  );
}

function ControlsPane() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
        <p className="text-sm text-muted-foreground">
          Click a shortcut to rebind it. ✕ disables it; Esc cancels.
        </p>
      </div>
      <KeybindingEditor />

      <div className="space-y-1 pt-2">
        <h2 className="text-base font-semibold">Mouse Controls</h2>
        <p className="text-sm text-muted-foreground">
          Choose which modifier each scroll gesture uses.
        </p>
      </div>
      <MouseModEditor />

      <div className="space-y-1 pt-2">
        <h2 className="text-base font-semibold">Fixed</h2>
      </div>
      <ShortcutList items={FIXED_SHORTCUTS} />
      <ShortcutList items={FIXED_MOUSE} />
    </div>
  );
}

interface AgentStatus {
  id: string;
  name: string;
  detected: boolean;
  installed: boolean;
}

function IntegrationsPane() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAgents()
      .then((a) => setAgents(a))
      .catch(() => {});
  }, []);

  async function toggle(agent: AgentStatus) {
    setBusy((s) => new Set(s).add(agent.id));
    setError(null);
    try {
      const result = agent.installed
        ? await api.uninstallSkill(agent.id)
        : await api.installSkill(agent.id);
      if (result && !result.ok) {
        setError(`${agent.name}: ${(result as { error?: string }).error ?? "Unknown error"}`);
      }
    } catch (err) {
      setError(`${agent.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const updated = await api.getAgents();
    setAgents(updated);
    setBusy((s) => {
      const next = new Set(s);
      next.delete(agent.id);
      return next;
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Install the Canvas Skill so AI agents can control
          the canvas from the terminal.
        </p>
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
      )}

      <div className="space-y-1.5">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center justify-between rounded-md px-3 py-2.5"
            style={{
              border:
                "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)",
            }}
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{agent.name}</p>
              <p className="text-xs text-muted-foreground">
                {agent.detected ? "Detected" : "Not found"}
              </p>
            </div>
            <button
              type="button"
              disabled={busy.has(agent.id)}
              onClick={() => { void toggle(agent); }}
              className="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: agent.installed
                  ? "color-mix(in srgb, var(--foreground) 8%, transparent)"
                  : "var(--foreground)",
                color: agent.installed
                  ? "var(--foreground)"
                  : "var(--background)",
              }}
            >
              {agent.installed ? "Uninstall" : "Install"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

type Pane = "appearance" | "terminal" | "integrations" | "controls";

const NAV_ITEMS: {
  id: Pane;
  label: string;
  icon: typeof Palette;
}[] = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "terminal", label: "Terminal", icon: Terminal },
    { id: "integrations", label: "Integrations", icon: PuzzlePiece },
    { id: "controls", label: "Controls", icon: Keyboard },
  ];

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onClick}
        aria-label="Close"
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-foreground/25 bg-transparent p-0 text-foreground/25 transition-opacity duration-150 hover:text-foreground/60 hover:border-foreground/60 cursor-pointer"
      >
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 3L9 9M9 3L3 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className="text-[11px] tracking-[0.05em] text-foreground/25 select-none pointer-events-none font-mono">
        esc
      </span>
    </div>
  );
}

export default function App() {
  const [activePane, setActivePane] =
    useState<Pane>("appearance");
  const [appVersion, setAppVersion] = useState("");
  const paneRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusInitialControl = () => {
      paneRef.current?.focus();
    };
    focusInitialControl();
    window.addEventListener("focus", focusInitialControl);
    return () =>
      window.removeEventListener("focus", focusInitialControl);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        api.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    api.getAppVersion()
      .then((v) => setAppVersion(v))
      .catch(() => { });
  }, []);

  return (
    <div
      ref={paneRef}
      tabIndex={-1}
      className="flex h-full w-full bg-background text-foreground focus:outline-none"
    >
      {/* Sidebar */}
      <div className="flex w-48 flex-col border-r border-border/50 bg-background p-3 pt-4">
        <div className="flex items-start gap-2 px-2">
          <CloseButton onClick={() => api.close()} />
        </div>

        <div className="px-2 mt-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <GearSix className="h-5 w-5" />
            Settings
          </h1>
        </div>

        <nav className="mt-3 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivePane(id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium ${activePane === id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">
                {label}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {appVersion && (
          <div className="px-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              v{appVersion}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activePane === "appearance" && <AppearancePane />}
        {activePane === "terminal" && <TerminalPane />}
        {activePane === "integrations" && <IntegrationsPane />}
        {activePane === "controls" && <ControlsPane />}
      </div>
    </div>
  );
}
