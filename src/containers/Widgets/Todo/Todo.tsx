import React, { useEffect, useRef, useState } from "react";
import TextInput from "../../../components/TextInput/TextInput";
import { resolveSurfaceFrost } from "../../../config/widgetConfig";
import { useAppContext } from "../../../contexts/AppContext";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { useT } from "../../../i18n/i18n";
import {
  hexToRgbChannels,
  isHighlightTextColor,
  resolveForeground,
} from "../../../utils/textHighlight";
import { useScaledPx } from "../../../utils/viewportScale";
import { EditIcon } from "../../../components/Icons/Icons";
import { ClearIcon, DragIndicatorIcon } from "../../../components/Icons/Icons";
import {
  clearLegacyTodos,
  readLegacyTodos,
} from "../../../storage/legacyMigrations";
import {
  readSync as readPersisted,
  write as writePersisted,
} from "../../../storage/hybridStorage";
import "./Todo.css";

interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

// Keep aligned with the leave animation duration in Todo.css. The
// item stays mounted for this long after the user clicks delete so
// the slide-out animation can complete before React unmounts it.
const REMOVE_ANIM_MS = 340;

// Keep aligned with `todo-item-complete` in Todo.css. The .completing
// class is added on a unchecked→checked toggle and stripped after
// this many ms so the bouncy pop plays once per completion.
const COMPLETE_ANIM_MS = 480;

// Storage key. Renamed from the bare "todo_data" used during dev to
// the namespaced "ghiblify_todo" so every persisted entry the app
// owns starts with the same prefix. The migration helper below
// folds any old "todo_data" value into the new key on first read.
const STORAGE_KEY = "ghiblify_todo";

// Debounced persist - coalesces typing bursts on the inline edit
// input so the storage layer doesn't take a write per keystroke.
// Module-scoped because the timer needs to survive remounts (the
// user tapping out of edit mode and back in shouldn't drop a pending
// write). Multiple Todo instances (canvas + dock) all share this
// timer + the broadcast event below so they stay in sync.
let persistTimer: number | null = null;
let persistPendingValue: TodoItem[] | null = null;
// Cross-instance sync: when one Todo widget updates the list, every
// other mounted Todo (e.g. the dock copy) needs to re-render to the
// new array. We dispatch a custom event with the next array as the
// detail and have each instance subscribe.
const TODO_CHANGE_EVENT = "ghiblify:todo:change";
const broadcastTodos = (next: TodoItem[]) => {
  window.dispatchEvent(
    new CustomEvent<TodoItem[]>(TODO_CHANGE_EVENT, { detail: next })
  );
};
const persistTodos = (next: TodoItem[]) => {
  persistPendingValue = next;
  // Sibling instances should reflect the change immediately, even
  // before the debounced storage write commits. Fire the event on
  // every call to persistTodos.
  broadcastTodos(next);
  if (persistTimer != null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    if (persistPendingValue) writePersisted(STORAGE_KEY, persistPendingValue);
    persistTimer = null;
    persistPendingValue = null;
  }, 300);
};

// Force-write any pending value immediately. Called on
// visibilitychange/pagehide so a quick close-mid-typing doesn't drop
// the last few keystrokes.
const flushPersistTodos = () => {
  if (persistTimer != null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (persistPendingValue) {
    writePersisted(STORAGE_KEY, persistPendingValue);
    persistPendingValue = null;
  }
};

// One-time read of the previous in-app key. If we find anything,
// rewrite it to the new key and delete the old one. Idempotent.
const readModernTodosOrMigrate = (): TodoItem[] | null => {
  const current = readPersisted<TodoItem[] | null>(STORAGE_KEY, null);
  if (current && current.length) return current;
  try {
    const old = localStorage.getItem("todo_data");
    if (!old) return null;
    const parsed = JSON.parse(old) as TodoItem[];
    writePersisted(STORAGE_KEY, parsed);
    localStorage.removeItem("todo_data");
    return parsed;
  } catch {
    return null;
  }
};

export const Todo: React.FC = () => {
  const t = useT();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Items mid-leave animation. Removed from `todos` only after
  // REMOVE_ANIM_MS so the CSS can finish playing.
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  // Items added since mount - only newly-added items get the slide-in
  // animation, otherwise every page load would cascade-in the entire
  // saved list.
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  // Items that just transitioned unchecked→checked. Drives the
  // bouncy "task completed" pop on the row; stripped after
  // COMPLETE_ANIM_MS so subsequent re-renders don't re-trigger it.
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const { appearance } = useAppContext();
  const { settings: todoSettings } = useWidgetSettings("todo");
  // settings.width/height are reference-px (1920 baseline); scale to
  // current-viewport px so the widget stays proportional to screen.
  const width = useScaledPx(todoSettings.width);
  const height = useScaledPx(todoSettings.height);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flush any pending debounced todo write when the tab hides or
  // the widget unmounts, so a quick close-mid-typing doesn't drop
  // the last keystrokes.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushPersistTodos();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushPersistTodos);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushPersistTodos);
      flushPersistTodos();
    };
  }, []);

  // Cross-instance sync: when any other Todo widget calls
  // persistTodos, mirror the new list into our local state so canvas
  // and dock instances stay in lockstep without a page reload.
  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<TodoItem[]>).detail;
      if (Array.isArray(next)) setTodos(next);
    };
    window.addEventListener(TODO_CHANGE_EVENT, handler);
    return () => window.removeEventListener(TODO_CHANGE_EVENT, handler);
  }, []);

  useEffect(() => {
    const savedTodos = readModernTodosOrMigrate();
    if (savedTodos && savedTodos.length) {
      setTodos(savedTodos);
      return;
    }
    // No modern todos stored - try to pull from the previous
    // (jQuery) Ghiblify extension's chrome.storage.local["todo_data"]
    // (a "×"-separated string with optional "☑" prefix per item).
    // Cleared from chrome.storage on success so it's idempotent.
    let cancelled = false;
    readLegacyTodos().then((legacy) => {
      if (cancelled || !legacy || !legacy.length) return;
      setTodos(legacy);
      persistTodos(legacy);
      clearLegacyTodos();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addTodo = () => {
    if (!inputValue.trim()) return;
    const newTodo: TodoItem = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      checked: false,
    };
    setTodos((prev) => {
      const next = [...prev, newTodo];
      persistTodos(next);
      return next;
    });
    setEnteringIds((prev) => {
      const next = new Set(prev);
      next.add(newTodo.id);
      return next;
    });
    window.setTimeout(() => {
      setEnteringIds((prev) => {
        if (!prev.has(newTodo.id)) return prev;
        const next = new Set(prev);
        next.delete(newTodo.id);
        return next;
      });
    }, 280);
    setInputValue("");
  };

  const toggleTodo = (id: string) => {
    // Detect unchecked→checked so we can trigger the celebrate-pop
    // animation only on completion (not on un-checking, which sends
    // the row back up into the active list).
    const before = todos.find((t) => t.id === id);
    const becomingChecked = !!before && !before.checked;
    setTodos((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, checked: !t.checked } : t
      );
      persistTodos(next);
      return next;
    });
    if (becomingChecked) {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      window.setTimeout(() => {
        setCompletingIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, COMPLETE_ANIM_MS);
    }
  };

  const deleteTodo = (id: string) => {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setTodos((prev) => {
        const next = prev.filter((t) => t.id !== id);
        persistTodos(next);
        return next;
      });
      setRemovingIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, REMOVE_ANIM_MS);
  };

  const updateTodoText = (id: string, newText: string) => {
    setTodos((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, text: newText } : t));
      persistTodos(next);
      return next;
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addTodo();
  };

  // Leaving edit mode with empty text means the user erased the
  // todo's content - there's no clickable surface left to re-enter
  // edit mode (the .todo-text span has no content), so the item
  // would be stranded. Treat empty-on-leave as "I want this gone"
  // and auto-delete instead.
  const finishEdit = (id: string) => {
    const t = todos.find((x) => x.id === id);
    if (t && t.text.trim() === "") {
      deleteTodo(id);
    }
    setEditingId(null);
  };

  const handleEditKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string
  ) => {
    if (e.key === "Enter" || e.key === "Escape") finishEdit(id);
  };

  // Drag-and-drop reordering. Refs mirror the React state so the
  // synchronous onDrop handler reads the very latest values even if
  // React hasn't committed the dragOver render yet (closures over
  // useState values were going stale and dropping items in the wrong
  // slot, especially at the first / last positions).
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<"before" | "after" | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const dropTargetIdRef = useRef<string | null>(null);
  const dropPosRef = useRef<"before" | "after" | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const resetDrag = () => {
    draggedIdRef.current = null;
    dropTargetIdRef.current = null;
    dropPosRef.current = null;
    setDraggedId(null);
    setDropTargetId(null);
    setDropPos(null);
  };

  const handleDragStart = (id: string) => {
    draggedIdRef.current = id;
    setDraggedId(id);
  };
  const updateDropTarget = (id: string, pos: "before" | "after") => {
    dropTargetIdRef.current = id;
    dropPosRef.current = pos;
    setDropTargetId(id);
    setDropPos(pos);
  };

  // Bound to the whole widget, not to the <ul>. The list is only as
  // tall as its rows, so releasing a hair below the last item - the
  // most natural way to say "put it at the end" - landed outside the
  // drop zone, and a drag that ends outside one is cancelled outright.
  // Anywhere in the widget now completes the drop; the row-midpoint
  // scan below already clamps to the first/last row when the cursor is
  // above or below every one of them.
  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    if (!draggedIdRef.current) return;
    // The drop only counts as allowed while something keeps calling
    // this. Miss one frame at the release point and the browser reverts
    // the drag instead of firing onDrop.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    autoScrollList(e.clientY);

    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(".todo-item"),
    );
    let targetId: string | null = null;
    let targetPos: "before" | "after" = "after";

    for (const item of items) {
      const id = item.dataset.todoId;
      if (!id) continue;
      const rect = item.getBoundingClientRect();
      targetId = id;
      if (e.clientY < rect.top + rect.height / 2) {
        targetPos = "before";
        break;
      }
      targetPos = "after";
    }

    if (targetId) updateDropTarget(targetId, targetPos);
  };

  // A tall list scrolls, and a native drag doesn't scroll it for you:
  // without this, rows outside the visible window are unreachable -
  // you can pick an item up but never carry it to where it belongs.
  const autoScrollList = (clientY: number) => {
    const list = listRef.current;
    if (!list || list.scrollHeight <= list.clientHeight) return;
    const rect = list.getBoundingClientRect();
    const zone = 28;
    if (clientY < rect.top + zone) list.scrollTop -= 10;
    else if (clientY > rect.bottom - zone) list.scrollTop += 10;
  };

  const handleDrop = (id: string) => {
    const dragged = draggedIdRef.current;
    const pos = dropPosRef.current ?? "before";
    if (!dragged || dragged === id) {
      resetDrag();
      return;
    }
    setTodos((prev) => {
      // Work in VISIBLE order (incomplete-first, completed-last) so
      // drop positions match what the user actually sees. Previously
      // we used `prev` directly, which is storage order - dragging a
      // completed item visually after an incomplete one would land it
      // in the wrong spot in storage.
      const visible = prev
        .slice()
        .sort((a, b) =>
          a.checked === b.checked ? 0 : a.checked ? 1 : -1
        );
      const fromIdx = visible.findIndex((t) => t.id === dragged);
      const targetIdx = visible.findIndex((t) => t.id === id);
      if (fromIdx < 0 || targetIdx < 0) return prev;
      const next = [...visible];
      const [removed] = next.splice(fromIdx, 1);
      let insertAt = targetIdx;
      if (fromIdx < targetIdx) insertAt -= 1;
      if (pos === "after") insertAt += 1;
      next.splice(insertAt, 0, removed);
      persistTodos(next);
      return next;
    });
    resetDrag();
  };
  const handleDragEnd = () => resetDrag();

  // Sort: incomplete first, completed at bottom. Items mid-leave stay
  // rendered so the exit can play.
  const visibleTodos = todos
    .slice()
    .sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));
  const frosted = resolveSurfaceFrost(
    todoSettings.frosted,
    appearance.theme,
  );
  const surfaceRgb =
    typeof todoSettings.surfaceColor === "string"
      ? hexToRgbChannels(todoSettings.surfaceColor)
      : null;
  const rowRgb =
    typeof todoSettings.rowColor === "string"
      ? hexToRgbChannels(todoSettings.rowColor)
      : null;
  const rowTextMode = isHighlightTextColor(todoSettings.rowTextColor)
    ? todoSettings.rowTextColor
    : "auto";
  const rowInk =
    typeof todoSettings.rowColor === "string"
      ? resolveForeground(todoSettings.rowColor, rowTextMode)
      : rowTextMode === "light"
        ? "#f7f3ea"
        : rowTextMode === "dark"
          ? "#1f2420"
          : null;
  const todoStyle = {
    width: `${width}px`,
    maxHeight: `${height}px`,
    "--todo-opacity": frosted ? 0.14 : todoSettings.opacity / 100,
    "--input-opacity": frosted ? 0.14 : todoSettings.rowOpacity / 100,
    "--todo-row-opacity": todoSettings.rowOpacity / 100,
    ...(surfaceRgb ? { "--todo-surface-rgb": surfaceRgb } : {}),
    ...(rowRgb
      ? { "--todo-row-rgb": rowRgb, "--dark-rgb": rowRgb }
      : {}),
    ...(rowInk
      ? {
          "--todo-text": rowInk,
          "--todo-text-muted": `color-mix(in srgb, ${rowInk} 60%, transparent)`,
          "--light": rowInk,
        }
      : {}),
  } as React.CSSProperties;

  return (
    <div
      className={`todo-container widget-header${frosted ? " todo-frosted" : ""}`}
      style={todoStyle}
      onDragOver={handleDragOver}
      onDrop={(e) => {
        const targetId = dropTargetIdRef.current;
        if (!draggedIdRef.current || !targetId) return;
        e.preventDefault();
        handleDrop(targetId);
      }}
    >
      <div className="todo-input-wrapper">
        <TextInput
          ref={inputRef}
          type="text"
          placeholder={t("todo.addPlaceholder")}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        {inputValue.trim() && (
          <button
            className="todo-add-btn"
            onClick={addTodo}
            aria-label={t("todo.addAria")}
            data-tooltip={t("todo.addTooltip")}
          >
            +
          </button>
        )}
      </div>
      <ul className="todo-list" ref={listRef}>
          {visibleTodos.map((todo) => (
            <li
              key={todo.id}
              data-todo-id={todo.id}
              className={[
                "todo-item",
                todo.checked ? "checked" : "",
                draggedId === todo.id ? "dragging" : "",
                dropTargetId === todo.id && draggedId !== todo.id
                  ? `drop-target drop-${dropPos ?? "before"}`
                  : "",
                removingIds.has(todo.id) ? "removing" : "",
                enteringIds.has(todo.id) ? "entering" : "",
                completingIds.has(todo.id) ? "completing" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="todo-item-content">
                <button
                  className="todo-checkbox"
                  onClick={() => toggleTodo(todo.id)}
                  aria-label={
                    todo.checked
                      ? t("todo.checkboxAriaDone")
                      : t("todo.checkboxAriaNotDone")
                  }
                  aria-pressed={todo.checked}
                  data-tooltip={
                    todo.checked
                      ? t("todo.checkboxTooltipDone")
                      : t("todo.checkboxTooltipNotDone")
                  }
                >
                  {todo.checked && (
                    /* Inline thick-stroke check - Material's filled
                       CheckIcon (used elsewhere) has lots of viewBox
                       padding and reads as a thin glyph in this small
                       box. A stroke-rendered polyline with rounded
                       caps fills the box and gives a clearly-visible
                       checkmark. currentColor inherits the button's
                       active text color. */
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="3,12 9,18.5 21,5.5" />
                    </svg>
                  )}
                </button>
                {editingId === todo.id ? (
                  <TextInput
                    id={`todo-edit-${todo.id}`}
                    type="text"
                    className="todo-edit-input"
                    value={todo.text}
                    onChange={(e) => updateTodoText(todo.id, e.target.value)}
                    onKeyDown={(e) => handleEditKeyPress(e, todo.id)}
                    onBlur={() => finishEdit(todo.id)}
                    autoFocus
                  />
                ) : (
                  <span
                    className="todo-text"
                    onClick={() => setEditingId(todo.id)}
                  >
                    <span className="todo-text-inner">{todo.text}</span>
                  </span>
                )}
                {editingId !== todo.id && (
                  <button
                    className="todo-edit-btn"
                    onClick={() => setEditingId(todo.id)}
                    aria-label={t("todo.editAria", { text: todo.text })}
                    data-tooltip={t("todo.editTooltip")}
                  >
                    <EditIcon style={{ fontSize: "14px" }} />
                  </button>
                )}
                <button
                  className="todo-delete-btn"
                  onClick={() => deleteTodo(todo.id)}
                  aria-label={t("todo.deleteAria", { text: todo.text })}
                  data-tooltip={t("todo.deleteTooltip")}
                >
                  <ClearIcon style={{ fontSize: "14px" }} />
                </button>
                <span
                  className="todo-drag-handle"
                  aria-hidden="true"
                  data-tooltip={t("todo.dragHandleTooltip")}
                  // Drag is initiated from the handle ONLY so clicks on
                  // the row text / checkbox / edit / delete buttons
                  // never accidentally start a drag (a slightly-moved
                  // mousedown on a draggable parent counts as drag-
                  // start, which made the widget feel finicky).
                  // Completed tasks are not draggable - they always sort
                  // to the bottom anyway, so reordering them is a no-op
                  // that the user shouldn't even attempt.
                  draggable={!todo.checked}
                  onDragStart={(e) => {
                    if (
                      document.body.classList.contains("show-widget-outline")
                    ) {
                      e.preventDefault();
                      return;
                    }
                    // Use the parent <li> as the drag preview so the
                    // whole row visibly travels with the cursor, not
                    // just the handle icon.
                    const li = (e.currentTarget as HTMLElement).closest(
                      ".todo-item"
                    ) as HTMLElement | null;
                    if (li) {
                      e.dataTransfer.setDragImage(li, 0, 0);
                    }
                    try {
                      e.dataTransfer.setData("text/plain", todo.id);
                      e.dataTransfer.effectAllowed = "move";
                    } catch {
                      /* ignore */
                    }
                    handleDragStart(todo.id);
                  }}
                  onDragEnd={handleDragEnd}
                >
                  <DragIndicatorIcon style={{ fontSize: 16 }} />
                </span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
};
