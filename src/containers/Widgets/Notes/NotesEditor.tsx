import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  EditorState,
  ElementFormatType,
  ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
} from "lexical";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import { AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from "@lexical/selection";
import {
  $findMatchingParent,
  $getNearestNodeOfType,
  mergeRegister,
} from "@lexical/utils";
import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  HEADING,
  HIGHLIGHT,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
  type ElementTransformer,
} from "@lexical/markdown";
import { useAppContext } from "../../../contexts/AppContext";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { useT } from "../../../i18n/i18n";
import { Z_FLOATING } from "../../../utils/zLayers";
import "./Notes.css";

// Sticky-note widget, Lexical edition - Notion-ish. Bold / italic /
// underline / strikethrough / highlight text formats, headings,
// quotes, bullet + ordered + check lists, and auto-linked URLs, with
// a floating toolbar on text selection (keyboard shortcuts
// Cmd/Ctrl+B/I/U come free with RichTextPlugin). Markdown typing
// shortcuts: "# " heading, "> " quote, "- " bullet, "1. " ordered,
// "[] " checklist, **bold**, *italic*, ~~strike~~, ==highlight==.
//
// Persistence model - designed so pre-Lexical users lose nothing:
//   richContent - serialized EditorState JSON, the rich source of truth
//   content     - plaintext mirror kept in lockstep, so a downgraded
//                 build (which only knows `content`) still shows text
// A legacy note (no richContent) imports `content` line-by-line as
// literal plain paragraphs - "- " prefixes stay visible dashes, so the
// note looks EXACTLY as it did in the textarea. Markdown shortcuts
// only fire on typing, never against stored text.
//
// The note is one shared document across canvas + dock (same as the
// textarea era): writes go through updateWidgetSettings (canvas
// layer). Each surface mounts its own editor instance; the
// ExternalSyncPlugin folds remote changes (other surface, other tab,
// Reset All Widgets) into any instance that is NOT currently focused,
// so the typing instance never has its caret stomped.

// --- Initial state -----------------------------------------------------------

/** Import plain text lines as literal paragraphs (exact visual parity
 *  with the old textarea - no markdown reinterpretation). */
const $importPlainText = (text: string) => {
  const root = $getRoot();
  text.split("\n").forEach((line) => {
    const p = $createParagraphNode();
    if (line) p.append($createTextNode(line));
    root.append(p);
  });
};

const buildInitialEditorState = (
  richContent: string | undefined,
  content: string,
): InitialConfigType["editorState"] => {
  if (richContent) {
    try {
      JSON.parse(richContent);
      return richContent;
    } catch {
      // Corrupted blob - fall back to the plaintext mirror below.
    }
  }
  return () => $importPlainText(content);
};

/** Plaintext mirror serializer. NOT $getRoot().getTextContent() - *  that
separates blocks with DOUBLE newlines, which would inflate
 *  the mirror with blank lines relative to what the user sees (and
 *  a later re-import of the mirror would show them). One block = one
 *  line; list items render with readable markers so the mirror still
 *  makes sense in a pre-Lexical build. */
const $toPlainTextMirror = (): string => {
  const lines: string[] = [];
  const walkList = (list: ListNode, depth: number) => {
    const type = list.getListType();
    let ordinal = list.getStart?.() ?? 1;
    list.getChildren().forEach((item) => {
      if (!(item instanceof ListItemNode)) return;
      const children = item.getChildren();
      const nested = children.find((c): c is ListNode => $isListNode(c));
      if (nested) {
        walkList(nested, depth + 1);
        return;
      }
      const indent = "  ".repeat(depth);
      const marker =
        type === "check"
          ? item.getChecked?.()
            ? "- [x] "
            : "- [ ] "
          : type === "number"
            ? `${ordinal++}. `
            : "- ";
      lines.push(indent + marker + item.getTextContent());
    });
  };
  $getRoot()
    .getChildren()
    .forEach((node) => {
      if ($isListNode(node)) walkList(node, 0);
      else if ($isHorizontalRuleNode(node)) lines.push("---");
      else lines.push(node.getTextContent());
    });
  return lines.join("\n");
};

// --- Persist plugin ----------------------------------------------------------

interface PersistHandle {
  /** JSON of the last state we persisted OR applied from outside - *  the
  loop guard for both directions of sync. */
  lastSynced: string | null;
}

const DEBOUNCE_MS = 300;

const PersistPlugin: React.FC<{
  handle: React.MutableRefObject<PersistHandle>;
}> = ({ handle }) => {
  const { updateWidgetSettings } = useAppContext();
  const pending = useRef<{ json: string; text: string } | null>(null);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!pending.current) return;
    const { json, text } = pending.current;
    pending.current = null;
    handle.current.lastSynced = json;
    updateWidgetSettings("notes", { content: text, richContent: json });
  }, [handle, updateWidgetSettings]);

  // Debounced persist - coalesces typing bursts (same cadence the
  // textarea had). Unmount flushes so the tail of a burst isn't lost
  // when the tab closes right after typing.
  const onChange = useCallback(
    (editorState: EditorState) => {
      const json = JSON.stringify(editorState.toJSON());
      if (json === handle.current.lastSynced) return;
      let text = "";
      editorState.read(() => {
        text = $toPlainTextMirror();
      });
      pending.current = { json, text };
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, DEBOUNCE_MS);
    },
    [flush, handle],
  );

  useEffect(() => flush, [flush]);

  return <OnChangePlugin onChange={onChange} ignoreSelectionChange />;
};

// --- External sync plugin ----------------------------------------------------

const ExternalSyncPlugin: React.FC<{
  richContent: string | undefined;
  content: string;
  handle: React.MutableRefObject<PersistHandle>;
}> = ({ richContent, content, handle }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const incoming = richContent ?? null;
    // Our own persist echoing back through settings - ignore.
    if (incoming === handle.current.lastSynced) return;
    // Never stomp the caret of the instance the user is typing in;
    // its own state is already the source of the change stream.
    const rootEl = editor.getRootElement();
    if (rootEl && rootEl === document.activeElement) return;
    handle.current.lastSynced = incoming;
    if (incoming) {
      try {
        editor.setEditorState(editor.parseEditorState(incoming));
        return;
      } catch {
        // Corrupted incoming blob - rebuild from the plaintext mirror.
      }
    }
    // No rich payload (Reset All Widgets, legacy write) - re-import
    // the plaintext mirror.
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      $importPlainText(content);
    });
  }, [editor, richContent, content, handle]);

  return null;
};

// --- Floating toolbar --------------------------------------------------------

// Divider transformer (typing "---" / "***" / "___" on its own line) -
// @lexical/markdown doesn't ship one because HorizontalRuleNode lives
// in @lexical/react; this mirrors the playground's.
const HORIZONTAL_RULE: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => ($isHorizontalRuleNode(node) ? "---" : null),
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _children, _match, isImport) => {
    const line = $createHorizontalRuleNode();
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }
    line.selectNext();
  },
  type: "element",
};

// Only the markdown transformers that make sense in a sticky note -
// deliberately no code blocks (would pull @lexical/code) and no
// image/table syntax.
const MARKDOWN_TRANSFORMERS = [
  HORIZONTAL_RULE,
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CHECK_LIST,
  LINK,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  HIGHLIGHT,
];

// URL / email auto-linking as the user types.
const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
const EMAIL_MATCHER =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const LINK_MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text);
    if (match === null) return null;
    const fullMatch = match[0];
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: fullMatch.startsWith("http") ? fullMatch : `https://${fullMatch}`,
    };
  },
  (text: string) => {
    const match = EMAIL_MATCHER.exec(text);
    if (match === null) return null;
    return {
      index: match.index,
      length: match[0].length,
      text: match[0],
      url: `mailto:${match[0]}`,
    };
  },
];

const TEXT_FORMATS: { format: TextFormatType; labelKey: string }[] = [
  { format: "bold", labelKey: "notes.toolbar.bold" },
  { format: "italic", labelKey: "notes.toolbar.italic" },
  { format: "underline", labelKey: "notes.toolbar.underline" },
  { format: "strikethrough", labelKey: "notes.toolbar.strikethrough" },
];

// Marker palette. Applied as inline background-color via
// $patchStyleText (Lexical's bitmask `highlight` format is a single
// binary flag - it can't carry a colour; the ==markdown== shortcut
// still produces it and styles as the default yellow via
// .ne-highlight). Clicking the active colour clears it.
const HIGHLIGHT_MARKS = [
  { key: "yellow", labelKey: "notes.toolbar.colors.yellow", css: "rgba(255, 205, 92, 0.55)" },
  { key: "green", labelKey: "notes.toolbar.colors.green", css: "rgba(151, 216, 156, 0.55)" },
  { key: "pink", labelKey: "notes.toolbar.colors.pink", css: "rgba(255, 158, 196, 0.5)" },
  { key: "blue", labelKey: "notes.toolbar.colors.blue", css: "rgba(140, 199, 255, 0.5)" },
];

// Ink palette - dark tones stay readable on light paper; light tones
// are for dark/frosted paper or coloured swatches. Empty css = the
// default ink (clears the inline colour).
const TEXT_COLORS = [
  { key: "default", labelKey: "notes.toolbar.colors.default", css: "" },
  { key: "red", labelKey: "notes.toolbar.colors.red", css: "#b3452e" },
  { key: "blue", labelKey: "notes.toolbar.colors.blue", css: "#2f5e8c" },
  { key: "green", labelKey: "notes.toolbar.colors.green", css: "#3e6b42" },
  { key: "purple", labelKey: "notes.toolbar.colors.purple", css: "#6b4a8c" },
  { key: "white", labelKey: "notes.toolbar.colors.white", css: "#faf6ef" },
  { key: "paleYellow", labelKey: "notes.toolbar.colors.paleYellow", css: "#f2e2a8" },
  { key: "palePink", labelKey: "notes.toolbar.colors.palePink", css: "#f3c9d4" },
  { key: "paleBlue", labelKey: "notes.toolbar.colors.paleBlue", css: "#bcd6ef" },
  { key: "paleGreen", labelKey: "notes.toolbar.colors.paleGreen", css: "#c3ddc0" },
];

// Font-size steps, em-based so they scale with the surface's base size
// (14px on the canvas note, smaller in dock cells) instead of pinning
// one absolute px across both. Empty css = the base size (clears the
// inline style). glyphPx sizes the "A" preview in the menu rows.
const FONT_SIZES = [
  { key: "small", css: "0.85em", glyphPx: 10, labelKey: "notes.toolbar.sizes.small" },
  { key: "normal", css: "", glyphPx: 12, labelKey: "notes.toolbar.sizes.normal" },
  { key: "large", css: "1.25em", glyphPx: 15, labelKey: "notes.toolbar.sizes.large" },
  { key: "huge", css: "1.6em", glyphPx: 18, labelKey: "notes.toolbar.sizes.huge" },
];

const ALIGN_CYCLE: ("left" | "center" | "right")[] = [
  "left",
  "center",
  "right",
];

const FormatGlyph: React.FC<{ format: TextFormatType }> = ({ format }) => {
  switch (format) {
    case "bold":
      return <span className="notes-tb-glyph notes-tb-b">B</span>;
    case "italic":
      return <span className="notes-tb-glyph notes-tb-i">I</span>;
    case "underline":
      return <span className="notes-tb-glyph notes-tb-u">U</span>;
    case "strikethrough":
      return <span className="notes-tb-glyph notes-tb-s">S</span>;
    default:
      // highlight - marker tip
      return (
        <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M2 12.5 8.8 5.7l2.5 2.5-6.8 6.8H2v-2.5zM9.9 4.6l1.8-1.8a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-1.8 1.8-2.5-2.5z"
            fill="currentColor"
          />
        </svg>
      );
  }
};

const BulletGlyph = () => (
  <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
    <circle cx="3" cy="4" r="1.4" fill="currentColor" />
    <circle cx="3" cy="8" r="1.4" fill="currentColor" />
    <circle cx="3" cy="12" r="1.4" fill="currentColor" />
    <path
      d="M6.5 4h7M6.5 8h7M6.5 12h7"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const AlignGlyph: React.FC<{ align: "left" | "center" | "right" }> = ({
  align,
}) => {
  // Four bars; the short ones sit left / center / right per mode.
  const short = (y: number) =>
    align === "left"
      ? { x1: 2, x2: 10, y }
      : align === "center"
        ? { x1: 4, x2: 12, y }
        : { x1: 6, x2: 14, y };
  return (
    <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
      {[3, 6.4, 9.8, 13.2].map((y, i) => {
        const bar = i % 2 === 1 ? short(y) : { x1: 2, x2: 14, y };
        return (
          <line
            key={y}
            x1={bar.x1}
            x2={bar.x2}
            y1={bar.y}
            y2={bar.y}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

const CheckGlyph = () => (
  <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
    <rect
      x="1.5"
      y="1.5"
      width="13"
      height="13"
      rx="3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="m4.5 8.2 2.4 2.4 4.6-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NumberedGlyph = () => (
  <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
    {["1", "2", "3"].map((n, i) => (
      <text
        key={n}
        x="1"
        y={5.6 + i * 4}
        fontSize="5.2"
        fontWeight="700"
        fill="currentColor"
      >
        {n}
      </text>
    ))}
    <path
      d="M6.5 4h7M6.5 8h7M6.5 12h7"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IndentGlyph: React.FC<{ out?: boolean }> = ({ out }) => (
  <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M2 3h12M8 6.7h6M8 10h6M2 13.3h12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {out ? (
      <path d="M5.6 6.4 2.6 8.35l3 1.95z" fill="currentColor" />
    ) : (
      <path d="M2.6 6.4l3 1.95-3 1.95z" fill="currentColor" />
    )}
  </svg>
);

const DividerGlyph = () => (
  <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M2 8h12"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <path
      d="M4 3.5h8M4 12.5h8"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      opacity="0.4"
    />
  </svg>
);

const LinkGlyph = () => (
  <svg
    className="notes-tb-glyph"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M6.4 9.6 9.6 6.4" />
    <path d="M7.3 4.6l1.6-1.6a2.5 2.5 0 0 1 3.5 0l.6.6a2.5 2.5 0 0 1 0 3.5L11.4 8.7" />
    <path d="M8.7 11.4l-1.6 1.6a2.5 2.5 0 0 1-3.5 0l-.6-.6a2.5 2.5 0 0 1 0-3.5l1.6-1.6" />
  </svg>
);

const ClearFormatGlyph = () => (
  <svg
    className="notes-tb-glyph"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M3 3.2h8M7 3.2 5.2 12.8" strokeWidth="1.6" />
    <path d="M10.2 10.2l4 4M14.2 10.2l-4 4" strokeWidth="1.4" />
  </svg>
);

type ActiveListType = "bullet" | "check" | "number" | null;
type ActiveBlockType = "h1" | "h2" | "h3" | "quote" | null;

// Plain paragraph - the "off" row in the list menu.
const NoListGlyph = () => (
  <svg className="notes-tb-glyph" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M2 4h12M2 8h12M2 12h8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const LIST_OPTIONS: {
  Glyph: React.FC;
  key: ActiveListType;
  labelKey: string;
}[] = [
  { key: null, labelKey: "notes.toolbar.listNone", Glyph: NoListGlyph },
  { key: "bullet", labelKey: "notes.toolbar.bulletList", Glyph: BulletGlyph },
  {
    key: "number",
    labelKey: "notes.toolbar.numberedList",
    Glyph: NumberedGlyph,
  },
  { key: "check", labelKey: "notes.toolbar.checkList", Glyph: CheckGlyph },
];

const TOOLBAR_GAP_PX = 8;
const TOOLBAR_VIEWPORT_MARGIN_PX = 8;

const FloatingToolbarPlugin: React.FC = () => {
  const t = useT();
  const [editor] = useLexicalComposerContext();
  const [pos, setPos] = useState<{
    x: number;
    top: number;
    bottom: number;
  } | null>(null);
  // Flipped beneath the complete note when there's no viewport
  // headroom above it.
  const [below, setBelow] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [listType, setListType] = useState<ActiveListType>(null);
  const [blockType, setBlockType] = useState<ActiveBlockType>(null);
  const [align, setAlign] = useState<ElementFormatType>("left");
  const [markColor, setMarkColor] = useState<string>("");
  const [textColor, setTextColor] = useState<string>("");
  const [fontSize, setFontSize] = useState<string>("");
  // URL of the link the caret currently sits in ("" = not in a link),
  // and the draft being typed in the link popover's input.
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [linkDraft, setLinkDraft] = useState<string>("");
  // Focusing the URL input replaces the document selection, so the
  // browser stops painting the editor's highlight and you lose sight
  // of which words you're linking. These are the client rects of the
  // range captured at open time, repainted as an overlay - purely
  // visual, so the note's content and undo history stay untouched.
  const [linkRects, setLinkRects] = useState<DOMRect[]>([]);
  const [hasSelection, setHasSelection] = useState(false);
  const [canOutdent, setCanOutdent] = useState(false);
  // One drop-up menu at a time: marker palette, ink colour, font size,
  // block type, or the link popover. (Alignment is a cycle button.)
  const [openGroup, setOpenGroup] = useState<
    "mark" | "ink" | "size" | "block" | "link" | "list" | "more" | null
  >(null);
  // The link popover moves focus INTO the toolbar (its URL input), so
  // both the blur-hide listener and the focus gate in refresh() need
  // to recognise the toolbar as "still ours".
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [toolbarX, setToolbarX] = useState<number | null>(null);
  // The menus open UPWARD by default (drop-up above the toolbar). When
  // the note sits near the top of the screen that overflows off-screen,
  // so we measure the open menu and flip it below the button instead.
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuBelow, setMenuBelow] = useState(false);

  // The note may sit flush against either viewport edge, and the dock
  // places it close to the right edge by design. Measure the real bar
  // (its width changes slightly with list context and translations),
  // keep its centre within the viewport, and use its actual height to
  // decide whether it belongs above or below the paper.
  useLayoutEffect(() => {
    if (!pos) {
      setToolbarX(null);
      return;
    }
    const el = toolbarRef.current;
    if (!el) return;
    const place = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const half = width / 2;
      const minX = TOOLBAR_VIEWPORT_MARGIN_PX + half;
      const maxX = Math.max(
        minX,
        window.innerWidth - TOOLBAR_VIEWPORT_MARGIN_PX - half,
      );
      const nextX = Math.min(Math.max(pos.x, minX), maxX);
      const nextBelow =
        pos.top - TOOLBAR_GAP_PX - height < TOOLBAR_VIEWPORT_MARGIN_PX;
      setToolbarX((current) =>
        current !== null && Math.abs(current - nextX) < 0.5
          ? current
          : nextX,
      );
      setBelow((current) => (current === nextBelow ? current : nextBelow));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [pos]);

  useLayoutEffect(() => {
    if (!openGroup) {
      setMenuBelow(false);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    const place = () => {
      // Reset the previous menu's correction before measuring this one.
      el.style.setProperty("--notes-menu-shift-x", "0px");
      const rect = el.getBoundingClientRect();
      const shiftX =
        rect.left < TOOLBAR_VIEWPORT_MARGIN_PX
          ? TOOLBAR_VIEWPORT_MARGIN_PX - rect.left
          : rect.right > window.innerWidth - TOOLBAR_VIEWPORT_MARGIN_PX
            ? window.innerWidth - TOOLBAR_VIEWPORT_MARGIN_PX - rect.right
            : 0;
      el.style.setProperty("--notes-menu-shift-x", `${shiftX}px`);
      // Measured in the default drop-up position; if its top clears the
      // viewport, drop it down instead.
      setMenuBelow(rect.top < TOOLBAR_VIEWPORT_MARGIN_PX);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [openGroup]);

  // Dismiss an open drop-up (colour pickers, size, block, list, the
  // overflow, and the link popover - they all live in `openGroup`) on
  // a click anywhere outside it, or on Escape. Picking an item or
  // losing editor focus already closed it, but clicking back into the
  // note, onto the wallpaper, or on a plain toolbar button used to
  // leave the menu hanging open.
  //
  // Two things must NOT close it: clicks on the menu's own rows (the
  // item's onClick has to run), and clicks on any group trigger -
  // those toggle `openGroup` themselves, so closing here first would
  // make the trigger reopen what the user meant to dismiss.
  //
  // Capture phase, so it still fires when something downstream stops
  // propagation (the link input does, to keep its own focus).
  // The overlay only belongs to the link popover - drop it whenever
  // that closes, however it closed (Escape, outside click, apply).
  useEffect(() => {
    if (openGroup !== "link") setLinkRects([]);
  }, [openGroup]);

  useEffect(() => {
    if (!openGroup) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".notes-tb-menu, .notes-tb-group")) return;
      setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  const refresh = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      // A caret alone is enough - the toolbar shows the whole time the
      // note is being edited, selection or not. Every control works on
      // a collapsed caret: text formats and colours become "pending"
      // and apply to whatever is typed next; block/list/align act on
      // the caret's block. Focus is the visibility gate (mirrors the
      // blur-hide listener below).
      const rootEl = editor.getRootElement();
      const focused =
        document.activeElement === rootEl ||
        !!toolbarRef.current?.contains(document.activeElement);
      if (!$isRangeSelection(selection) || !rootEl || !focused) {
        setPos(null);
        setOpenGroup(null);
        return;
      }
      setHasSelection(!selection.isCollapsed());
      const next: Record<string, boolean> = {};
      TEXT_FORMATS.forEach(({ format }) => {
        next[format] = selection.hasFormat(format);
      });
      setActive(next);
      const listNode = $getNearestNodeOfType(
        selection.anchor.getNode(),
        ListNode,
      );
      setListType(
        listNode && $isListNode(listNode)
          ? listNode.getListType() === "check"
            ? "check"
            : listNode.getListType() === "number"
              ? "number"
              : "bullet"
          : null,
      );
      // Outdent is a no-op unless some affected block is actually
      // indented. Mirrors $handleIndentAndOutdent's block selection
      // (nearest non-inline element ancestor, indentable only) so the
      // disabled state can't disagree with what the command would do.
      const seenBlocks = new Set<string>();
      setCanOutdent(
        selection.getNodes().some((node) => {
          const block = $findMatchingParent(
            node,
            (n): n is ElementNode => $isElementNode(n) && !n.isInline(),
          );
          if (!block || seenBlocks.has(block.getKey())) return false;
          seenBlocks.add(block.getKey());
          return block.canIndent() && block.getIndent() > 0;
        }),
      );
      // AutoLinkNode extends LinkNode, so typed links match too.
      const linkNode = $getNearestNodeOfType(
        selection.anchor.getNode(),
        LinkNode,
      );
      setLinkUrl(linkNode ? linkNode.getURL() : "");
      const top = selection.anchor.getNode().getTopLevelElement();
      setBlockType(
        $isHeadingNode(top)
          ? (top.getTag() as ActiveBlockType)
          : $isQuoteNode(top)
            ? "quote"
            : null,
      );
      setAlign(top?.getFormatType() || "left");
      setMarkColor(
        $getSelectionStyleValueForProperty(selection, "background-color", ""),
      );
      setTextColor(
        $getSelectionStyleValueForProperty(selection, "color", ""),
      );
      setFontSize(
        $getSelectionStyleValueForProperty(selection, "font-size", ""),
      );
      // Anchored to the NOTE, not the selection - a fixed bar above the
      // paper's top edge ("popup at the top"), so it neither chases the
      // caret around nor covers the line being edited. The anchor is
      // the PAPER (.notes-widget), not the contenteditable: the text
      // area sits ~18% inside the painted border, so anchoring to it
      // parked the bar on top of the note's decorative edge. When the
      // note touches the top of the screen the bar moves beneath the
      // paper instead of sliding off-screen or covering its text.
      const paperEl = rootEl.closest(".notes-widget") ?? rootEl;
      const rect = paperEl.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        top: rect.top,
        bottom: rect.bottom,
      });
    });
  }, [editor]);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(refresh),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            refresh();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor, refresh],
  );

  // Show on focus / hide on blur. Focus needs its own listener: the
  // toolbar appears as soon as the caret lands in the note, and on a
  // plain click-in Lexical may not fire an update if the selection
  // didn't move. Toolbar buttons preventDefault on mousedown so
  // pressing them doesn't count as leaving.
  useEffect(() => {
    // Focus moving into the toolbar (the link popover's input) isn't
    // "leaving" - the bar stays while the URL is being edited.
    const onBlur = (e: FocusEvent) => {
      const to = e.relatedTarget as Node | null;
      if (to && toolbarRef.current?.contains(to)) return;
      setPos(null);
    };
    const onFocus = () => refresh();
    return editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener("blur", onBlur);
      prevRootElement?.removeEventListener("focus", onFocus);
      rootElement?.addEventListener("blur", onBlur);
      rootElement?.addEventListener("focus", onFocus);
    });
  }, [editor, refresh]);

  if (!pos) return null;

  // Read the CURRENT list state inside the editor rather than
  // trusting the React state captured at render - a stale `listType`
  // would re-dispatch INSERT on a list that's already that type,
  // which nests it a level deeper instead of toggling it off.
  const toggleList = (type: Exclude<ActiveListType, null>) => {
    const current = editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return null;
      const listNode = $getNearestNodeOfType(
        selection.anchor.getNode(),
        ListNode,
      );
      return listNode && $isListNode(listNode)
        ? listNode.getListType()
        : null;
    });
    if (current === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else if (type === "check") {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
    } else if (type === "number") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    }
  };

  // Empty string = explicit "no highlight" (the None row); picking
  // the already-active colour also clears, so both paths toggle off.
  const applyMark = (css: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $patchStyleText(selection, {
        "background-color": css === "" || markColor === css ? null : css,
      });
    });
  };

  const applyTextColor = (css: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $patchStyleText(selection, { color: css === "" ? null : css });
    });
  };

  const applyFontSize = (css: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $patchStyleText(selection, { "font-size": css === "" ? null : css });
    });
  };

  const applyLink = (raw: string) => {
    const url = raw.trim();
    if (!url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      editor.dispatchCommand(
        TOGGLE_LINK_COMMAND,
        /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`,
      );
    }
    setOpenGroup(null);
    editor.focus();
  };

  // Strip everything character-level from the selection: toggled
  // formats (bold/italic/…) and inline styles (colour, highlight,
  // size). extract() splits the boundary text nodes so only the
  // selected span is reset. Block-level structure (headings, lists)
  // is left alone - the block-type menu handles those explicitly.
  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (selection.isCollapsed()) {
        // Nothing selected: reset the PENDING formats so what's typed
        // next comes out plain.
        (
          ["bold", "italic", "underline", "strikethrough", "highlight"] as const
        ).forEach((format) => {
          if (selection.hasFormat(format)) selection.toggleFormat(format);
        });
        $patchStyleText(selection, {
          color: null,
          "background-color": null,
          "font-size": null,
        });
        return;
      }
      selection.extract().forEach((node) => {
        if ($isTextNode(node)) {
          node.setFormat(0);
          node.setStyle("");
        }
      });
    });
  };

  const cycleAlign = () => {
    const current = ALIGN_CYCLE.includes(align as "left")
      ? (align as "left" | "center" | "right")
      : "left";
    const next =
      ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(current) + 1) % ALIGN_CYCLE.length];
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, next);
  };

  const setBlock = (type: "paragraph" | Exclude<ActiveBlockType, null>) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (type === "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (type === "quote") {
        $setBlocksType(selection, () => $createQuoteNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(type));
      }
    });
    setOpenGroup(null);
  };

  // Compact primary row: high-frequency actions inline, pick-one-of-N
  // groups behind a single button showing the current state. Each
  // group opens a flyout row under the toolbar; one flyout at a time.
  const blockLabel =
    blockType === "h1"
      ? "H1"
      : blockType === "h2"
        ? "H2"
        : blockType === "h3"
          ? "H3"
          : blockType === "quote"
            ? "“"
            : "¶";
  const alignForGlyph =
    align === "center" || align === "right" ? align : "left";
  const BLOCK_OPTIONS = [
    { key: "paragraph" as const, glyph: "¶", labelKey: "notes.toolbar.paragraph" },
    { key: "h1" as const, glyph: "H1", labelKey: "notes.toolbar.heading1" },
    { key: "h2" as const, glyph: "H2", labelKey: "notes.toolbar.heading2" },
    { key: "h3" as const, glyph: "H3", labelKey: "notes.toolbar.heading3" },
    { key: "quote" as const, glyph: "“", labelKey: "notes.toolbar.quote" },
  ];

  return createPortal(
    <>
      {/* Stand-in for the native selection highlight while the URL
          input holds focus. Viewport coords, so these are fixed-
          positioned like the toolbar itself. */}
      {linkRects.map((r, i) => (
        <div
          key={i}
          className="notes-link-selection"
          aria-hidden
          style={{
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            zIndex: Z_FLOATING - 1,
          }}
        />
      ))}
      <div
        ref={toolbarRef}
        className={`notes-toolbar${below ? " below" : ""}`}
        style={{
          left: toolbarX ?? pos.x,
          top: below ? pos.bottom : pos.top,
          zIndex: Z_FLOATING,
        }}
      role="toolbar"
      aria-label={t("notes.toolbar.ariaLabel")}
      // Keep the editor selection alive while clicking buttons.
      onMouseDown={(e) => e.preventDefault()}
    >
      {TEXT_FORMATS.map(({ format, labelKey }) => (
        <button
          key={format}
          type="button"
          className={`notes-tb-btn${active[format] ? " active" : ""}`}
          aria-label={t(labelKey)}
          aria-pressed={!!active[format]}
          data-tip={t(labelKey)}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
        >
          <FormatGlyph format={format} />
        </button>
      ))}
      <span className="notes-tb-divider" />
      <span className="notes-tb-group">
        <button
          type="button"
          className={`notes-tb-btn${markColor ? " active" : ""}`}
          aria-label={t("notes.toolbar.highlight")}
          aria-haspopup="true"
          aria-expanded={openGroup === "mark"}
          data-tip={t("notes.toolbar.highlight")}
          // Marker glyph tints to the active colour so the collapsed
          // button still tells you what's applied.
          style={markColor ? { color: markColor } : undefined}
          onClick={() => setOpenGroup((g) => (g === "mark" ? null : "mark"))}
        >
          <FormatGlyph format="highlight" />
        </button>
        {openGroup === "mark" && (
          <div
            ref={menuRef}
            className={`notes-tb-menu${menuBelow ? " below" : ""}`}
            role="menu"
          >
            <button
              type="button"
              role="menuitemradio"
              aria-checked={markColor === ""}
              className={`notes-tb-menu-item${markColor === "" ? " active" : ""}`}
              onClick={() => {
                applyMark("");
                setOpenGroup(null);
              }}
            >
              <span
                className="notes-tb-dot"
                style={{ background: "transparent" }}
              />
              {t("widgets.contextMenu.highlightOff")}
            </button>
            {HIGHLIGHT_MARKS.map(({ key, labelKey, css }) => (
              <button
                key={key}
                type="button"
                role="menuitemradio"
                aria-checked={markColor === css}
                className={`notes-tb-menu-item${
                  markColor === css ? " active" : ""
                }`}
                onClick={() => {
                  applyMark(css);
                  setOpenGroup(null);
                }}
              >
                <span className="notes-tb-dot" style={{ background: css }} />
                {t(labelKey)}
              </button>
            ))}
          </div>
        )}
      </span>
      <span className="notes-tb-group">
        <button
          type="button"
          className={`notes-tb-btn${textColor ? " active" : ""}`}
          aria-label={t("notes.toolbar.textColor")}
          aria-haspopup="true"
          aria-expanded={openGroup === "ink"}
          data-tip={t("notes.toolbar.textColor")}
          style={textColor ? { color: textColor } : undefined}
          onClick={() => setOpenGroup((g) => (g === "ink" ? null : "ink"))}
        >
          <span className="notes-tb-glyph notes-tb-a">A</span>
        </button>
        {openGroup === "ink" && (
          <div
            ref={menuRef}
            className={`notes-tb-menu${menuBelow ? " below" : ""}`}
            role="menu"
          >
            {TEXT_COLORS.map(({ key, labelKey, css }) => {
              const isActive = css === "" ? textColor === "" : textColor === css;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`notes-tb-menu-item${isActive ? " active" : ""}`}
                  onClick={() => {
                    applyTextColor(css);
                    setOpenGroup(null);
                  }}
                >
                  <span
                    className="notes-tb-glyph notes-tb-a"
                    style={css ? { color: css } : undefined}
                  >
                    A
                  </span>
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        )}
      </span>
      <span className="notes-tb-group">
        <button
          type="button"
          className={`notes-tb-btn${fontSize ? " active" : ""}`}
          aria-label={t("notes.toolbar.fontSize")}
          aria-haspopup="true"
          aria-expanded={openGroup === "size"}
          data-tip={t("notes.toolbar.fontSize")}
          onClick={() => setOpenGroup((g) => (g === "size" ? null : "size"))}
        >
          <span className="notes-tb-glyph notes-tb-h">Aa</span>
        </button>
        {openGroup === "size" && (
          <div
            ref={menuRef}
            className={`notes-tb-menu${menuBelow ? " below" : ""}`}
            role="menu"
          >
            {FONT_SIZES.map(({ key, css, glyphPx, labelKey }) => {
              const isActive = fontSize === css;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`notes-tb-menu-item${isActive ? " active" : ""}`}
                  onClick={() => {
                    applyFontSize(css);
                    setOpenGroup(null);
                  }}
                >
                  <span
                    className="notes-tb-glyph notes-tb-a"
                    style={{ fontSize: glyphPx }}
                  >
                    A
                  </span>
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        )}
      </span>
      <span className="notes-tb-group">
        <button
          type="button"
          className={`notes-tb-btn${blockType ? " active" : ""}`}
          aria-label={t("notes.toolbar.blockType")}
          aria-haspopup="true"
          aria-expanded={openGroup === "block"}
          data-tip={t("notes.toolbar.blockType")}
          onClick={() => setOpenGroup((g) => (g === "block" ? null : "block"))}
        >
          <span className="notes-tb-glyph notes-tb-h">{blockLabel}</span>
        </button>
        {openGroup === "block" && (
          <div
            ref={menuRef}
            className={`notes-tb-menu${menuBelow ? " below" : ""}`}
            role="menu"
          >
            {BLOCK_OPTIONS.map(({ key, glyph, labelKey }) => {
              const isActive =
                key === "paragraph" ? blockType === null : blockType === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`notes-tb-menu-item${isActive ? " active" : ""}`}
                  onClick={() => setBlock(key)}
                >
                  <span className="notes-tb-glyph notes-tb-h">{glyph}</span>
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        )}
      </span>
      <span className="notes-tb-group">
        {/* Link: disabled with nothing to act on (no selection AND not
            inside an existing link). With the caret in a link, opens
            pre-filled for editing; Apply on empty input = unlink. */}
        <button
          type="button"
          className={`notes-tb-btn${linkUrl ? " active" : ""}`}
          aria-label={t("notes.toolbar.link")}
          aria-haspopup="true"
          aria-expanded={openGroup === "link"}
          data-tip={t("notes.toolbar.link")}
          disabled={!hasSelection && !linkUrl}
          onClick={() => {
            const opening = openGroup !== "link";
            setLinkDraft(linkUrl);
            // Captured here, before the input's autoFocus moves focus
            // and the live selection is gone. The toolbar's mousedown
            // preventDefault is what keeps it intact this long.
            if (opening) {
              const native = window.getSelection();
              setLinkRects(
                native && native.rangeCount > 0 && !native.isCollapsed
                  ? Array.from(native.getRangeAt(0).getClientRects())
                  : [],
              );
            }
            setOpenGroup(opening ? "link" : null);
          }}
        >
          <LinkGlyph />
        </button>
        {openGroup === "link" && (
          <div
            ref={menuRef}
            className={`notes-tb-menu notes-tb-link${menuBelow ? " below" : ""}`}
            role="menu"
          >
            <input
              type="text"
              className="notes-tb-link-input"
              value={linkDraft}
              placeholder={t("notes.toolbar.linkPlaceholder")}
              autoFocus
              onChange={(e) => setLinkDraft(e.target.value)}
              // The toolbar container preventDefaults mousedown to keep
              // the editor selection alive - the input needs the default
              // back or it can never take focus.
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink(linkDraft);
                } else if (e.key === "Escape") {
                  setOpenGroup(null);
                  editor.focus();
                }
              }}
              onBlur={(e) => {
                // Leaving the input for anywhere outside the toolbar or
                // editor dismisses the bar (the editor's own blur-hide
                // can't see this - the editor already lost focus when
                // the input took it).
                const to = e.relatedTarget as Node | null;
                const rootEl = editor.getRootElement();
                if (
                  to &&
                  (toolbarRef.current?.contains(to) || rootEl?.contains(to))
                )
                  return;
                setOpenGroup(null);
                setPos(null);
              }}
            />
            {linkUrl && (
              <button
                type="button"
                role="menuitem"
                className="notes-tb-menu-item"
                onClick={() => applyLink("")}
              >
                {t("notes.toolbar.linkRemove")}
              </button>
            )}
          </div>
        )}
      </span>
      <span className="notes-tb-divider" />
      {/* All three list types behind one button showing the current
          one - three always-visible toggles dominated the bar for an
          either/or choice. */}
      <span className="notes-tb-group">
        <button
          type="button"
          className={`notes-tb-btn${listType ? " active" : ""}`}
          aria-label={t("notes.toolbar.list")}
          aria-haspopup="true"
          aria-expanded={openGroup === "list"}
          data-tip={t("notes.toolbar.list")}
          onClick={() => setOpenGroup((g) => (g === "list" ? null : "list"))}
        >
          {listType === "number" ? (
            <NumberedGlyph />
          ) : listType === "check" ? (
            <CheckGlyph />
          ) : (
            <BulletGlyph />
          )}
        </button>
        {openGroup === "list" && (
          <div
            ref={menuRef}
            className={`notes-tb-menu${menuBelow ? " below" : ""}`}
            role="menu"
          >
            {LIST_OPTIONS.map(({ key, labelKey, Glyph }) => {
              const isActive = listType === key;
              return (
                <button
                  key={key ?? "none"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`notes-tb-menu-item${isActive ? " active" : ""}`}
                  onClick={() => {
                    // The menu's "None" row and re-picking the active
                    // type both mean "off" - toggleList already treats
                    // a repeat pick as removal.
                    if (key === null) {
                      if (listType) toggleList(listType);
                    } else {
                      toggleList(key);
                    }
                    setOpenGroup(null);
                  }}
                >
                  <Glyph />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        )}
      </span>
      {/* Indent controls and alignment swap by context rather than
          both sitting there half-disabled: list items indent (and
          Lexical won't align them anyway), everything else aligns. */}
      {listType !== null ? (
        <>
          <button
            type="button"
            className="notes-tb-btn"
            aria-label={t("notes.toolbar.outdent")}
            data-tip={t("notes.toolbar.outdent")}
            disabled={!canOutdent}
            onClick={() =>
              editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)
            }
          >
            <IndentGlyph out />
          </button>
          <button
            type="button"
            className="notes-tb-btn"
            aria-label={t("notes.toolbar.indent")}
            data-tip={t("notes.toolbar.indent")}
            onClick={() =>
              editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)
            }
          >
            <IndentGlyph />
          </button>
        </>
      ) : (
        /* Alignment cycles in place: left → center → right → left. The
           glyph always shows the CURRENT alignment. */
        <button
          type="button"
          className="notes-tb-btn"
          aria-label={t("notes.toolbar.align")}
          data-tip={t("notes.toolbar.align")}
          onClick={cycleAlign}
        >
          <AlignGlyph align={alignForGlyph} />
        </button>
      )}
      <span className="notes-tb-divider" />
      {/* Occasional actions live behind the overflow so the main row
          stays short. */}
      <span className="notes-tb-group">
        <button
          type="button"
          className="notes-tb-btn"
          aria-label={t("notes.toolbar.more")}
          aria-haspopup="true"
          aria-expanded={openGroup === "more"}
          data-tip={t("notes.toolbar.more")}
          onClick={() => setOpenGroup((g) => (g === "more" ? null : "more"))}
        >
          <span className="notes-tb-glyph notes-tb-more">···</span>
        </button>
        {openGroup === "more" && (
          <div
            ref={menuRef}
            className={`notes-tb-menu${menuBelow ? " below" : ""}`}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="notes-tb-menu-item"
              onClick={() => {
                editor.dispatchCommand(
                  INSERT_HORIZONTAL_RULE_COMMAND,
                  undefined,
                );
                setOpenGroup(null);
              }}
            >
              <DividerGlyph />
              {t("notes.toolbar.divider")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="notes-tb-menu-item"
              onClick={() => {
                clearFormatting();
                setOpenGroup(null);
              }}
            >
              <ClearFormatGlyph />
              {t("notes.toolbar.clearFormat")}
            </button>
          </div>
        )}
      </span>
      </div>
    </>,
    document.body,
  );
};

// --- Editor ------------------------------------------------------------------

// The heavy half of the note: the whole Lexical stack lives here so it
// can be code-split into its own chunk and lazy-loaded. The lightweight
// paper shell (Notes.tsx) renders instantly and drops this in once the
// chunk arrives, so the note no longer waits on Lexical to paint.
const NotesEditor: React.FC = () => {
  const t = useT();
  // Display reads merged settings - `showBorder` flips per surface
  // (dock + canvas can have different border states). Content writes
  // go through updateWidgetSettings (canvas-only) inside
  // PersistPlugin so the typed text stays a single shared note.
  const { settings } = useWidgetSettings("notes");

  // Shared loop-guard between persist (outbound) and external sync
  // (inbound). Seeded with the mounted state so neither direction
  // fires spuriously on mount.
  const syncHandle = useRef<PersistHandle>({
    lastSynced: settings.richContent ?? null,
  });

  // Editor config is mount-only ON PURPOSE: Lexical owns the document
  // after mount; later settings changes flow through
  // ExternalSyncPlugin instead of re-creating the editor.
  const initialConfig = useMemo<InitialConfigType>(
    () => ({
      namespace: "ghiblify-notes",
      onError: (error: Error) => console.error("[notes]", error),
      nodes: [
        ListNode,
        ListItemNode,
        HeadingNode,
        QuoteNode,
        LinkNode,
        AutoLinkNode,
        HorizontalRuleNode,
      ],
      editorState: buildInitialEditorState(
        settings.richContent,
        settings.content,
      ),
      theme: {
        paragraph: "ne-p",
        heading: { h1: "ne-h1", h2: "ne-h2", h3: "ne-h3" },
        quote: "ne-quote",
        link: "ne-link",
        hr: "ne-hr",
        text: {
          bold: "ne-bold",
          italic: "ne-italic",
          underline: "ne-underline",
          strikethrough: "ne-strike",
          highlight: "ne-highlight",
        },
        list: {
          ul: "ne-ul",
          ol: "ne-ol",
          listitem: "ne-li",
          listitemChecked: "ne-li-checked",
          listitemUnchecked: "ne-li-unchecked",
          nested: { listitem: "ne-nested-li" },
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="notes-editor-shell">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="notes-textarea notes-editor"
              aria-label={t("notes.ariaLabel")}
              spellCheck
            />
          }
          placeholder={
            <div className="notes-placeholder" aria-hidden>
              {t("notes.placeholder")}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <CheckListPlugin />
      <AutoLinkPlugin matchers={LINK_MATCHERS} />
      {/* Links open on Cmd/Ctrl+click while editing. */}
      <ClickableLinkPlugin />
      {/* Registers TOGGLE_LINK_COMMAND for the toolbar's link popover. */}
      <LinkPlugin />
      {/* Tab / Shift+Tab indent the caret's block (nested lists etc.). */}
      <TabIndentationPlugin />
      {/* Registers INSERT_HORIZONTAL_RULE_COMMAND for the divider button. */}
      <HorizontalRulePlugin />
      {/* Markdown shortcuts fire on TYPING only - stored legacy text
          is never reinterpreted, so a note that literally says
          "# groceries" keeps looking exactly like it always did. */}
      <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
      <PersistPlugin handle={syncHandle} />
      <ExternalSyncPlugin
        richContent={settings.richContent}
        content={settings.content}
        handle={syncHandle}
      />
      <FloatingToolbarPlugin />
    </LexicalComposer>
  );
};

export default NotesEditor;
