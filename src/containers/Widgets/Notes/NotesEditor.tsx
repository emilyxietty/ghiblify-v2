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
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  EditorState,
  ElementFormatType,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
} from "lexical";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
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
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from "@lexical/selection";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
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
} from "@lexical/markdown";
import { useAppContext } from "../../../contexts/AppContext";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { useT } from "../../../i18n/i18n";
import "./Notes.css";

// Sticky-note widget, Lexical edition — Notion-ish. Bold / italic /
// underline / strikethrough / highlight text formats, headings,
// quotes, bullet + ordered + check lists, and auto-linked URLs, with
// a floating toolbar on text selection (keyboard shortcuts
// Cmd/Ctrl+B/I/U come free with RichTextPlugin). Markdown typing
// shortcuts: "# " heading, "> " quote, "- " bullet, "1. " ordered,
// "[] " checklist, **bold**, *italic*, ~~strike~~, ==highlight==.
//
// Persistence model — designed so pre-Lexical users lose nothing:
//   richContent — serialized EditorState JSON, the rich source of truth
//   content     — plaintext mirror kept in lockstep, so a downgraded
//                 build (which only knows `content`) still shows text
// A legacy note (no richContent) imports `content` line-by-line as
// literal plain paragraphs — "- " prefixes stay visible dashes, so the
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
 *  with the old textarea — no markdown reinterpretation). */
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
      // Corrupted blob — fall back to the plaintext mirror below.
    }
  }
  return () => $importPlainText(content);
};

/** Plaintext mirror serializer. NOT $getRoot().getTextContent() —
 *  that separates blocks with DOUBLE newlines, which would inflate
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
      else lines.push(node.getTextContent());
    });
  return lines.join("\n");
};

// --- Persist plugin ----------------------------------------------------------

interface PersistHandle {
  /** JSON of the last state we persisted OR applied from outside —
   *  the loop guard for both directions of sync. */
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

  // Debounced persist — coalesces typing bursts (same cadence the
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
    // Our own persist echoing back through settings — ignore.
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
        // Corrupted incoming blob — rebuild from the plaintext mirror.
      }
    }
    // No rich payload (Reset All Widgets, legacy write) — re-import
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

// Only the markdown transformers that make sense in a sticky note —
// deliberately no code blocks (would pull @lexical/code) and no
// image/table syntax.
const MARKDOWN_TRANSFORMERS = [
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
// binary flag — it can't carry a colour; the ==markdown== shortcut
// still produces it and styles as the default yellow via
// .ne-highlight). Clicking the active colour clears it.
const HIGHLIGHT_MARKS = [
  { key: "yellow", labelKey: "notes.toolbar.colors.yellow", css: "rgba(255, 205, 92, 0.55)" },
  { key: "green", labelKey: "notes.toolbar.colors.green", css: "rgba(151, 216, 156, 0.55)" },
  { key: "pink", labelKey: "notes.toolbar.colors.pink", css: "rgba(255, 158, 196, 0.5)" },
  { key: "blue", labelKey: "notes.toolbar.colors.blue", css: "rgba(140, 199, 255, 0.5)" },
];

// Ink palette — dark tones stay readable on light paper; light tones
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
      // highlight — marker tip
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

type ActiveListType = "bullet" | "check" | null;
type ActiveBlockType = "h1" | "h2" | "h3" | "quote" | null;

const FloatingToolbarPlugin: React.FC = () => {
  const t = useT();
  const [editor] = useLexicalComposerContext();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [listType, setListType] = useState<ActiveListType>(null);
  const [blockType, setBlockType] = useState<ActiveBlockType>(null);
  const [align, setAlign] = useState<ElementFormatType>("left");
  const [markColor, setMarkColor] = useState<string>("");
  const [textColor, setTextColor] = useState<string>("");
  // One drop-up menu at a time: marker palette, ink colour, or block
  // type. (Alignment is a cycle button, not a menu.)
  const [openGroup, setOpenGroup] = useState<"mark" | "ink" | "block" | null>(
    null,
  );
  // The menus open UPWARD by default (drop-up above the toolbar). When
  // the note sits near the top of the screen that overflows off-screen,
  // so we measure the open menu and flip it below the button instead.
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuBelow, setMenuBelow] = useState(false);
  useLayoutEffect(() => {
    if (!openGroup) {
      setMenuBelow(false);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    // Measured in the default drop-up position; if its top clears the
    // viewport, drop it down instead.
    setMenuBelow(el.getBoundingClientRect().top < 8);
  }, [openGroup]);

  const refresh = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (
        !$isRangeSelection(selection) ||
        selection.isCollapsed() ||
        selection.getTextContent() === ""
      ) {
        setPos(null);
        setOpenGroup(null);
        return;
      }
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
            : "bullet"
          : null,
      );
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
      const native = window.getSelection();
      if (native && native.rangeCount > 0) {
        const rect = native.getRangeAt(0).getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.top });
      }
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

  // Hide when the editor loses focus. Toolbar buttons preventDefault
  // on mousedown so pressing them doesn't count as leaving.
  useEffect(() => {
    const onBlur = () => setPos(null);
    return editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener("blur", onBlur);
      rootElement?.addEventListener("blur", onBlur);
    });
  }, [editor]);

  if (!pos) return null;

  // Read the CURRENT list state inside the editor rather than
  // trusting the React state captured at render — a stale `listType`
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
    if (current === (type === "check" ? "check" : "bullet")) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else if (type === "check") {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
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
    <div
      className="notes-toolbar"
      style={{ left: pos.x, top: pos.y }}
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
      <span className="notes-tb-divider" />
      <button
        type="button"
        className={`notes-tb-btn${listType === "bullet" ? " active" : ""}`}
        aria-label={t("notes.toolbar.bulletList")}
        aria-pressed={listType === "bullet"}
        data-tip={t("notes.toolbar.bulletList")}
        onClick={() => toggleList("bullet")}
      >
        <BulletGlyph />
      </button>
      <button
        type="button"
        className={`notes-tb-btn${listType === "check" ? " active" : ""}`}
        aria-label={t("notes.toolbar.checkList")}
        aria-pressed={listType === "check"}
        data-tip={t("notes.toolbar.checkList")}
        onClick={() => toggleList("check")}
      >
        <CheckGlyph />
      </button>
      <span className="notes-tb-divider" />
      {/* Alignment cycles in place: left → center → right → left. The
          glyph always shows the CURRENT alignment. Disabled inside a
          list — bullet / checklist items are left-aligned by design and
          Lexical doesn't align list items anyway. */}
      <button
        type="button"
        className="notes-tb-btn"
        aria-label={t("notes.toolbar.align")}
        data-tip={t("notes.toolbar.align")}
        disabled={listType !== null}
        onClick={cycleAlign}
      >
        <AlignGlyph align={alignForGlyph} />
      </button>
    </div>,
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
  // Display reads merged settings — `showBorder` flips per surface
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
      {/* Markdown shortcuts fire on TYPING only — stored legacy text
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
