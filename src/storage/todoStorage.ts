// Task lists for the to-do widgets - one hybridStorage key per list
// slot (TODO_KEYS), kept outside the ghiblify_widgets blob so a widget
// layout reset never touches anyone's tasks.
//
// Writes are debounced and broadcast: every mounted instance of the
// SAME list (the canvas copy and the dock copy) re-renders from the
// broadcast immediately, and storage catches up 300ms later.

import type { TodoKey } from "../config/widgetConfig";
import {
  readSync as readPersisted,
  write as writePersisted,
} from "./hybridStorage";

export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

// The first key was renamed from the bare "todo_data" used during dev
// to the namespaced "ghiblify_todo" so every persisted entry the app
// owns starts with the same prefix. readTodos() folds any old
// "todo_data" value into it on first read.
const STORAGE_KEYS: Record<TodoKey, string> = {
  todo: "ghiblify_todo",
  todo2: "ghiblify_todo2",
};

// Module-scoped because the timer needs to survive remounts (the user
// tapping out of edit mode and back in shouldn't drop a pending
// write). One timer per list.
const persistTimers = new Map<TodoKey, number>();
const persistPending = new Map<TodoKey, TodoItem[]>();

const TODO_CHANGE_EVENT = "ghiblify:todo:change";
interface TodoChangeDetail {
  key: TodoKey;
  items: TodoItem[];
}

const broadcastTodos = (key: TodoKey, items: TodoItem[]) => {
  window.dispatchEvent(
    new CustomEvent<TodoChangeDetail>(TODO_CHANGE_EVENT, {
      detail: { key, items },
    })
  );
};

/** Mirror another instance's edits to `key` into `onChange`. Returns
 *  the unsubscribe, so it drops straight into a useEffect. */
export const subscribeTodos = (
  key: TodoKey,
  onChange: (items: TodoItem[]) => void
): (() => void) => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<TodoChangeDetail>).detail;
    if (detail?.key === key && Array.isArray(detail.items))
      onChange(detail.items);
  };
  window.addEventListener(TODO_CHANGE_EVENT, handler);
  return () => window.removeEventListener(TODO_CHANGE_EVENT, handler);
};

export const persistTodos = (key: TodoKey, next: TodoItem[]) => {
  persistPending.set(key, next);
  // Sibling instances should reflect the change immediately, even
  // before the debounced storage write commits.
  broadcastTodos(key, next);
  const pendingTimer = persistTimers.get(key);
  if (pendingTimer != null) window.clearTimeout(pendingTimer);
  persistTimers.set(
    key,
    window.setTimeout(() => {
      const value = persistPending.get(key);
      if (value) writePersisted(STORAGE_KEYS[key], value);
      persistTimers.delete(key);
      persistPending.delete(key);
    }, 300)
  );
};

/** Force-write any pending value immediately. Called on
 *  visibilitychange/pagehide so a quick close-mid-typing doesn't drop
 *  the last few keystrokes. */
export const flushPersistTodos = (key: TodoKey) => {
  const pendingTimer = persistTimers.get(key);
  if (pendingTimer != null) {
    window.clearTimeout(pendingTimer);
    persistTimers.delete(key);
  }
  const value = persistPending.get(key);
  if (value) {
    writePersisted(STORAGE_KEYS[key], value);
    persistPending.delete(key);
  }
};

/** Empty a list outright - no debounce, so an instance that mounts on
 *  the very next render (a freshly revealed second list) reads the
 *  blank list rather than the tasks it had before it was hidden. */
export const clearTodoList = (key: TodoKey) => {
  persistPending.set(key, []);
  flushPersistTodos(key);
  broadcastTodos(key, []);
};

// One-time read of the previous in-app key. If we find anything,
// rewrite it to the new key and delete the old one. Idempotent.
const migrateDevTodos = (): TodoItem[] => {
  try {
    const old = localStorage.getItem("todo_data");
    if (!old) return [];
    const parsed = JSON.parse(old) as TodoItem[];
    writePersisted(STORAGE_KEYS.todo, parsed);
    localStorage.removeItem("todo_data");
    return parsed;
  } catch {
    return [];
  }
};

/** The stored tasks for `key`; empty when there are none. */
export const readTodos = (key: TodoKey): TodoItem[] => {
  const current = readPersisted<TodoItem[] | null>(STORAGE_KEYS[key], null);
  if (current && current.length) return current;
  return key === "todo" ? migrateDevTodos() : [];
};
