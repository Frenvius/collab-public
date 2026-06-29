import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type UIEvent,
} from "react";
import type { ViewerItem } from "@collab/shared/types";
import { Editor } from "@collab/components/Editor";

const PALETTE: Array<{ body: string; text: string }> = [
	{ body: "#fef8c4", text: "#5c4036" },
	{ body: "#f8bad0", text: "#880e4e" },
	{ body: "#badefa", text: "#0c46a0" },
	{ body: "#c8e6c8", text: "#1a5e20" },
	{ body: "#fee0b2", text: "#e44400" },
	{ body: "#e0bee6", text: "#4a148c" },
	{ body: "#2c2c2c", text: "#fefefe" },
	{ body: "#36464e", text: "#fefefe" },
];

function textColorFor(hex: string): string {
	const found = PALETTE.find((p) => p.body.toLowerCase() === hex.toLowerCase());
	if (found) return found.text;
	const c = hex.replace("#", "");
	if (c.length < 6) return "#1a1a1a";
	const r = parseInt(c.slice(0, 2), 16);
	const g = parseInt(c.slice(2, 4), 16);
	const b = parseInt(c.slice(4, 6), 16);
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return lum > 0.55 ? "#1a1a1a" : "#f5f5f5";
}

const STYLE_ACTIONS = new Set(["bold", "italic", "underline", "strike", "code"]);
const BLOCK_TYPES: Record<string, string> = {
	heading: "heading",
	bulletList: "bulletListItem",
	numberedList: "numberedListItem",
	checkList: "checkListItem",
};
const ALIGN_ACTIONS: Record<string, "left" | "center" | "right"> = {
	alignLeft: "left",
	alignCenter: "center",
	alignRight: "right",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function selectedBlocks(editor: any): any[] {
	const selection = editor.getSelection?.();
	return selection?.blocks?.length
		? selection.blocks
		: [editor.getTextCursorPosition().block];
}

function runCommand(editor: any, action: string): void {
	if (!editor) return;
	editor.focus();
	if (STYLE_ACTIONS.has(action)) {
		editor.toggleStyles({ [action]: true });
		return;
	}
	const align = ALIGN_ACTIONS[action];
	if (align) {
		for (const block of selectedBlocks(editor)) {
			editor.updateBlock(block, { props: { textAlignment: align } });
		}
		return;
	}
	const type = BLOCK_TYPES[action];
	if (!type) return;
	for (const block of selectedBlocks(editor)) {
		editor.updateBlock(block, {
			type,
			...(type === "heading" ? { props: { level: 1 } } : {}),
		});
	}
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface StickyViewProps {
	item: ViewerItem;
	onTextChange: (
		text: string,
	) => Promise<{ ok: boolean; mtime: string; conflict?: boolean } | void>;
	initialColor: string;
	theme: "light" | "dark";
}

export function StickyView({
	item,
	onTextChange,
	initialColor,
	theme,
}: StickyViewProps) {
	const [color, setColor] = useState<string>(initialColor || "#fef8c4");
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const editorRef = useRef<any>(null);
	const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleScroll = (e: UIEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		el.classList.add("scrolling");
		if (scrollTimer.current) clearTimeout(scrollTimer.current);
		scrollTimer.current = setTimeout(
			() => el.classList.remove("scrolling"),
			800,
		);
	};

	useEffect(() => {
		return window.api.onStickyCommand((msg) => {
			if (msg.action === "color") {
				if (msg.value) setColor(msg.value);
				return;
			}
			runCommand(editorRef.current, msg.action);
		});
	}, []);

	return (
		<div
			className="sticky-note-view"
			onScroll={handleScroll}
			style={{
				["--sticky-text"]: textColorFor(color),
			} as CSSProperties}
		>
			<Editor
				currentItem={item}
				onTextChange={onTextChange}
				theme={theme}
				editingDisabled={!item.isEditable}
				placeholder="Click to edit..."
				hideFormattingToolbar
				onEditor={(e) => {
					editorRef.current = e;
				}}
			/>
		</div>
	);
}
