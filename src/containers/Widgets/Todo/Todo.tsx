import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import React, { useEffect, useRef, useState } from "react";
import TextInput from "../../../components/TextInput/TextInput";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
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
const REMOVE_ANIM_MS = 240;

// Storage key. Renamed from the bare "todo_data" used during dev to
// the namespaced "ghiblify_todo" so every persisted entry the app
// owns starts with the same prefix. The migration helper below
// folds any old "todo_data" value into the new key on first read.
const STORAGE_KEY = "ghiblify_todo";

// Debounced persist — coalesces typing bursts on the inline edit
// input so the storage layer doesn't take a write per keystroke.
// Module-scoped because a single user only ever sees one Todo widget,
// and we want the timer to survive remounts (the user tapping out of
// edit mode and back in again shouldn't drop a pending write).
let persistTimer: number | null = null;
let persistPendingValue: TodoItem[] | null = null;
const persistTodos = (next: TodoItem[]) => {
  persistPendingValue = next;
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
  // Items added since mount — only newly-added items get the slide-in
  // animation, otherwise every page load would cascade-in the entire
  // saved list.
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const { widgets } = useAppContext();
  const todoSettings = widgets.todo.settings;
  const width = todoSettings.width;
  const height = todoSettings.height;
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

  useEffect(() => {
    const savedTodos = readModernTodosOrMigrate();
    if (savedTodos && savedTodos.length) {
      setTodos(savedTodos);
      return;
    }
    // No modern todos stored — try to pull from the previous
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
    setTodos((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, checked: !t.checked } : t
      );
      persistTodos(next);
      return next;
    });
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

  const handleEditKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    _id: string
  ) => {
    if (e.key === "Enter" || e.key === "Escape") setEditingId(null);
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
  const dropPosRef = useRef<"before" | "after" | null>(null);

  const resetDrag = () => {
    draggedIdRef.current = null;
    dropPosRef.current = null;
    setDraggedId(null);
    setDropTargetId(null);
    setDropPos(null);
  };

  const handleDragStart = (id: string) => {
    draggedIdRef.current = id;
    setDraggedId(id);
  };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos: "before" | "after" =
      e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    dropPosRef.current = pos;
    setDropTargetId(id);
    setDropPos(pos);
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
      // we used `prev` directly, which is storage order — dragging a
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

  return (
    <div
      className="todo-container widget-header"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ["--todo-opacity" as any]:
          ((todoSettings as any).opacity ?? 50) / 100,
        ["--input-opacity" as any]:
          ((todoSettings as any).opacity ?? 50) / 100,
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
        <button
          className="todo-add-btn"
          onClick={addTodo}
          disabled={!inputValue.trim()}
          aria-label={t("todo.addAria")}
          data-tooltip={t("todo.addTooltip")}
        >
          +
        </button>
      </div>
      <ul
        className="todo-list"
        // Edge-of-list drop: when the cursor is above the first item
        // or below the last, the inner <li> handlers don't fire (the
        // cursor is in empty whitespace). Snap the drop indicator to
        // before-first / after-last so the user can drag to top or
        // bottom without having to land precisely on the edge row.
        onDragOver={(e) => {
          if (!draggedIdRef.current) return;
          const items = Array.from(
            (e.currentTarget as HTMLElement).querySelectorAll(".todo-item")
          ) as HTMLElement[];
          if (items.length === 0) return;
          const firstRect = items[0].getBoundingClientRect();
          const lastRect = items[items.length - 1].getBoundingClientRect();
          if (e.clientY < firstRect.top) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const id = visibleTodos[0]?.id;
            if (id) {
              dropPosRef.current = "before";
              setDropTargetId(id);
              setDropPos("before");
            }
          } else if (e.clientY > lastRect.bottom) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const id = visibleTodos[visibleTodos.length - 1]?.id;
            if (id) {
              dropPosRef.current = "after";
              setDropTargetId(id);
              setDropPos("after");
            }
          }
        }}
        onDrop={(e) => {
          // Fall-through drop from the edge-of-list dragover above.
          // The inner <li> onDrop covers the in-between cases.
          if (!draggedIdRef.current || !dropTargetId) return;
          e.preventDefault();
          handleDrop(dropTargetId);
        }}
      >
          {visibleTodos.map((todo) => (
            <li
              key={todo.id}
              className={[
                "todo-item",
                todo.checked ? "checked" : "",
                draggedId === todo.id ? "dragging" : "",
                dropTargetId === todo.id && draggedId !== todo.id
                  ? `drop-target drop-${dropPos ?? "before"}`
                  : "",
                removingIds.has(todo.id) ? "removing" : "",
                enteringIds.has(todo.id) ? "entering" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              // Only the .todo-drag-handle is draggable (see below).
              // The <li> itself acts as the drop target.
              onDragOver={(e) => {
                if (!draggedIdRef.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                handleDragOver(e, todo.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(todo.id);
              }}
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
                  {todo.checked && <CheckIcon style={{ fontSize: "14px" }} />}
                </button>
                {editingId === todo.id ? (
                  <TextInput
                    id={`todo-edit-${todo.id}`}
                    type="text"
                    className="todo-edit-input"
                    value={todo.text}
                    onChange={(e) => updateTodoText(todo.id, e.target.value)}
                    onKeyDown={(e) => handleEditKeyPress(e, todo.id)}
                    onBlur={() => setEditingId(null)}
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
                  // Completed tasks are not draggable — they always sort
                  // to the bottom anyway, so reordering them is a no-op
                  // that the user shouldn't even attempt.
                  draggable={!todo.checked}
                  onDragStart={(e) => {
                    // Shift on the handle means the user is dragging
                    // the whole widget — bail so the widget-shell
                    // handler wins.
                    if (e.shiftKey) {
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
