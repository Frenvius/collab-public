import type { AppConfig } from "./config";

export interface Binding {
  code: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export interface KeybindingDef {
  action: string;
  label: string;
  primary: boolean;
  shift?: boolean;
  alt?: boolean;
  code: string;
}

const DEFS: KeybindingDef[] = [
  { action: "toggle-settings", label: "Settings", primary: true, code: "Comma" },
  { action: "sidebar-files", label: "Toggle Files", primary: true, code: "KeyB" },
  { action: "focus-file-search", label: "Find", primary: true, code: "KeyK" },
  { action: "new-tile", label: "New Tile", primary: true, code: "KeyN" },
  { action: "close-tile", label: "Close Tile", primary: true, code: "KeyW" },
  { action: "add-workspace", label: "Open Workspace", primary: true, shift: true, code: "KeyO" },
  { action: "reopen-tile", label: "Reopen Closed Tile", primary: true, shift: true, code: "KeyT" },
  { action: "toggle-fullscreen-tile", label: "Toggle Tile Fullscreen", primary: true, alt: true, code: "KeyF" },
  { action: "focus-tile-left", label: "Focus Tile Left", primary: true, alt: true, code: "ArrowLeft" },
  { action: "focus-tile-right", label: "Focus Tile Right", primary: true, alt: true, code: "ArrowRight" },
  { action: "focus-tile-up", label: "Focus Tile Up", primary: true, alt: true, code: "ArrowUp" },
  { action: "focus-tile-down", label: "Focus Tile Down", primary: true, alt: true, code: "ArrowDown" },
];

function defaultBinding(def: KeybindingDef, isMac: boolean): Binding {
  return {
    code: def.code,
    meta: def.primary && isMac,
    ctrl: def.primary && !isMac,
    shift: !!def.shift,
    alt: !!def.alt,
  };
}

function readOverrides(config: AppConfig): Record<string, Binding | null> {
  const raw = config.ui.keybindings;
  if (raw && typeof raw === "object") {
    return raw as Record<string, Binding | null>;
  }
  return {};
}

export interface EffectiveBinding {
  action: string;
  label: string;
  binding: Binding | null;
  isDefault: boolean;
}

export function effectiveBindings(
  config: AppConfig,
  isMac: boolean,
): EffectiveBinding[] {
  const overrides = readOverrides(config);
  return DEFS.map((def) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(
      overrides,
      def.action,
    );
    return {
      action: def.action,
      label: def.label,
      binding: hasOverride ? overrides[def.action]! : defaultBinding(def, isMac),
      isDefault: !hasOverride,
    };
  });
}

export function inputMatches(
  input: { code: string; control: boolean; meta: boolean; alt: boolean; shift: boolean },
  b: Binding,
): boolean {
  return (
    input.code === b.code &&
    input.control === !!b.ctrl &&
    input.meta === !!b.meta &&
    input.alt === !!b.alt &&
    input.shift === !!b.shift
  );
}

const CODE_TO_ACCEL: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Space: "Space",
};

function codeToAccel(code: string): string {
  if (CODE_TO_ACCEL[code]) return CODE_TO_ACCEL[code]!;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

export function bindingToAccelerator(b: Binding): string {
  const parts: string[] = [];
  if (b.meta) parts.push("Command");
  if (b.ctrl) parts.push("Control");
  if (b.alt) parts.push("Alt");
  if (b.shift) parts.push("Shift");
  parts.push(codeToAccel(b.code));
  return parts.join("+");
}

export function setOverride(
  config: AppConfig,
  action: string,
  binding: Binding | null,
): void {
  const overrides = readOverrides(config);
  overrides[action] = binding;
  config.ui.keybindings = overrides;
}

export function clearOverride(config: AppConfig, action: string | null): void {
  if (action === null) {
    config.ui.keybindings = {};
    return;
  }
  const overrides = readOverrides(config);
  delete overrides[action];
  config.ui.keybindings = overrides;
}
