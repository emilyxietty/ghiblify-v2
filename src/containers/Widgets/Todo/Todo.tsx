import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import EditNoteIcon from "@mui/icons-material/EditNote";
import React, { useEffect, useRef, useState } from "react";
import TextInput from "../../../components/TextInput/TextInput";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
import {
  clearLegacyTodos,
  readLegacyTodos,
} from "../../../storage/legacyMigrations";
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

const persistTodos = (next: TodoItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Failed to save todos:", err);
  }
};

// One-time read of the previous in-app key. If we find anything,
// rewrite it to the new key and delete the old one. Idempotent.
const readModernTodosOrMigrate = (): string | null => {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return current;
    const old = localStorage.getItem("todo_data");
    if (!old) return null;
    localStorage.setItem(STORAGE_KEY, old);
    localStorage.removeItem("todo_data");
    return old;
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

  useEffect(() => {
    const savedTodos = readModernTodosOrMigrate();
    if (savedTodos) {
      try {
        setTodos(JSON.parse(savedTodos));
        return;
      } catch (err) {
        console.error("Failed to parse saved todos:", err);
      }
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
      const fromIdx = prev.findIndex((t) => t.id === dragged);
      const targetIdx = prev.findIndex((t) => t.id === id);
      if (fromIdx < 0 || targetIdx < 0) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      // Insertion index in the post-splice array. If the dragged
      // item was before the target, the target shifted left by 1
      // when we spliced it out.
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

  const isEmpty = todos.length === 0;

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
      {isEmpty ? (
        <div className="todo-empty">
          <EditNoteIcon className="todo-empty-icon" />
          <p className="todo-empty-title">{t("todo.emptyTitle")}</p>
          <p className="todo-empty-sub">{t("todo.emptySub")}</p>
        </div>
      ) : (
        <ul className="todo-list">
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
              draggable
              onDragStart={(e) => {
                // Shift means the user is dragging the whole widget —
                // bail so the widget-shell handler wins.
                if (e.shiftKey) {
                  e.preventDefault();
                  return;
                }
                try {
                  e.dataTransfer.setData("text/plain", todo.id);
                  e.dataTransfer.effectAllowed = "move";
                } catch {
                  /* ignore */
                }
                handleDragStart(todo.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                handleDragOver(e, todo.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(todo.id);
              }}
              onDragEnd={handleDragEnd}
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
                >
                  <DragIndicatorIcon style={{ fontSize: 16 }} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
