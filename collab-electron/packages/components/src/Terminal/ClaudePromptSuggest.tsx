import * as React from "react";
import { Terminal as TerminalIcon, Bot } from "lucide-react";

export interface PromptSuggestion {
  id: string;
  display: string;
  subtext?: string;
  icon: "cmd" | "model";
}

export interface ClaudeSuggestHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

interface SuggestProps {
  isOpen: boolean;
  query: string;
  fetchFn: (query: string) => Promise<PromptSuggestion[]>;
  onSelect: (item: PromptSuggestion, submit?: boolean) => void;
  onHighlight?: ((item: PromptSuggestion) => void) | undefined;
  onClose: () => void;
}

export const ClaudePromptSuggest = React.forwardRef<
  ClaudeSuggestHandle,
  SuggestProps
>(({ isOpen, query, fetchFn, onSelect, onHighlight, onClose }, ref) => {
  if (!isOpen) return null;
  return (
    <SuggestInner
      ref={ref}
      query={query}
      fetchFn={fetchFn}
      onSelect={onSelect}
      onHighlight={onHighlight}
      onClose={onClose}
    />
  );
});
ClaudePromptSuggest.displayName = "ClaudePromptSuggest";

type InnerProps = Omit<SuggestProps, "isOpen">;

const SuggestInner = React.forwardRef<ClaudeSuggestHandle, InnerProps>(
  ({ query, fetchFn, onSelect, onHighlight, onClose }, ref) => {
    const [suggestions, setSuggestions] = React.useState<PromptSuggestion[]>(
      [],
    );
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const [fetched, setFetched] = React.useState(false);
    const reqNumRef = React.useRef(0);
    const listRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      reqNumRef.current++;
      const req = reqNumRef.current;
      void fetchFn(query).then((results) => {
        if (reqNumRef.current !== req) return;
        setSuggestions(results ?? []);
        setSelectedIndex(0);
        setFetched(true);
      });
    }, [query, fetchFn]);

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (listRef.current && !listRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    React.useEffect(() => {
      if (!listRef.current) return;
      const child = listRef.current.children[selectedIndex];
      if (child) (child as HTMLElement).scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    React.useImperativeHandle(
      ref,
      () => ({
        handleKeyDown(e: React.KeyboardEvent): boolean {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            if (suggestions.length === 0) return true;
            const newIdx = Math.min(selectedIndex + 1, suggestions.length - 1);
            setSelectedIndex(newIdx);
            const next = suggestions[newIdx];
            if (next) onHighlight?.(next);
            return true;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            if (suggestions.length === 0) return true;
            const newIdx = Math.max(selectedIndex - 1, 0);
            setSelectedIndex(newIdx);
            const next = suggestions[newIdx];
            if (next) onHighlight?.(next);
            return true;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            if (suggestions.length === 0) return false;
            e.preventDefault();
            e.stopPropagation();
            const sel = suggestions[selectedIndex];
            if (sel != null) {
              onSelect(sel, e.key === "Enter");
            }
            return true;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
            return true;
          }
          return false;
        },
      }),
      [suggestions, selectedIndex, onSelect, onHighlight, onClose],
    );

    if (!fetched) return null;

    return (
      <div ref={listRef} className="claude-prompt-suggest">
        {suggestions.length === 0 ? (
          <div className="claude-prompt-suggest-empty">No results</div>
        ) : (
          suggestions.map((item, i) => (
            <div
              key={item.id}
              className={
                "claude-prompt-suggest-item" +
                (i === selectedIndex ? " is-selected" : "")
              }
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
                onClose();
              }}
            >
              {item.icon === "model" ? (
                <Bot size={13} className="claude-prompt-suggest-icon" />
              ) : (
                <TerminalIcon size={13} className="claude-prompt-suggest-icon" />
              )}
              <span className="claude-prompt-suggest-display">
                {item.display}
              </span>
              {item.subtext && (
                <span className="claude-prompt-suggest-sub">
                  {item.subtext}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    );
  },
);
SuggestInner.displayName = "ClaudePromptSuggestInner";
