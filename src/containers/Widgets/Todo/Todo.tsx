import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import Popper from "@mui/material/Popper";
import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import "./Todo.css";

interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

export const Todo: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const { todoSettings, todoCollapsed, updateTodoCollapsed, isDragging } =
    useAppContext();
  const width = todoSettings.width;
  const height = todoSettings.height;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  // initialize anchorEl based on persisted collapsed state
  useEffect(() => {
    if (!todoCollapsed && headerRef.current && !anchorEl) {
      setAnchorEl(headerRef.current);
    }
    if (todoCollapsed && anchorEl) {
      setAnchorEl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoCollapsed]);

  useEffect(() => {
    const savedTodos = localStorage.getItem("todo_data");
    if (savedTodos) {
      try {
        const parsed = JSON.parse(savedTodos);
        setTodos(parsed);
      } catch (error) {
        console.error("Error parsing todos:", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("todo_data", JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo: TodoItem = {
        id: Date.now().toString(),
        text: inputValue.trim(),
        checked: false,
      };
      setTodos((prev) => [...prev, newTodo]);
      setInputValue("");
    }
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t))
    );
  };

  const deleteTodo = (id: string) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const updateTodoText = (id: string, newText: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: newText } : t))
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addTodo();
  };

  const handleEditKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string
  ) => {
    if (e.key === "Enter" || e.key === "Escape") setEditingId(null);
  };

  // Note: removed a global mousedown stopPropagation handler so inputs
  // inside the Popper can receive events. Popper is rendered with
  // `disablePortal` (below) so the popover lives inside the widget DOM
  // and won't be treated as a click-outside by the app-level handler.

  const sortedTodos = [...todos].sort((a, b) =>
    a.checked === b.checked ? 0 : a.checked ? 1 : -1
  );

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (index: number) => setDragOverIndex(index);
  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    const updated = [...sortedTodos];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);
    setTodos(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div
      className={`todo-container ${todoCollapsed ? "collapsed" : ""} ${
        todoSettings.darkMode ? "todo-dark" : ""
      }`}
      style={{ width: `${width}px` }}
    >
      <div
        className="todo-header widget-header"
        ref={headerRef}
        tabIndex={0}
        onClick={() => {
          if (isDragging) return;
          if (anchorEl) {
            setAnchorEl(null);
            updateTodoCollapsed(true);
          } else if (headerRef.current) {
            setAnchorEl(headerRef.current);
            updateTodoCollapsed(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (isDragging) return;
            if (anchorEl) {
              setAnchorEl(null);
              updateTodoCollapsed(true);
            } else if (headerRef.current) {
              setAnchorEl(headerRef.current);
              updateTodoCollapsed(false);
            }
          }
        }}
        aria-expanded={!todoCollapsed}
      >
        <span className="todo-title-text">Todo</span>
        {!todoCollapsed && (
          <span className="todo-hover-label" aria-hidden="true">
            (hide)
          </span>
        )}
      </div>

      <Popper
        disablePortal
        open={Boolean(anchorEl) && !todoCollapsed}
        anchorEl={anchorEl}
        placement="bottom"
        modifiers={
          [
            {
              name: "preventOverflow",
              options: { boundary: "viewport", padding: 16 },
            },
            { name: "flip", options: { fallbackPlacements: ["top"] } },
          ] as any
        }
      >
        <div
          className="todo-popover"
          style={{ width: `${width}px`, padding: 12 }}
        >
          <div style={{ padding: 0 }}>
            {/* hide inputs and list while dragging */}
            {!isDragging && (
              <>
                <div className="todo-input-wrapper">
                  <input
                    ref={inputRef}
                    type="text"
                    className="todo-input"
                    placeholder="Add a task..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  {inputValue && (
                    <button className="todo-add-btn" onClick={addTodo}>
                      +
                    </button>
                  )}
                </div>

                {todos.length > 0 && (
                  <ul className="todo-list">
                    {sortedTodos.map((todo, index) => (
                      <li
                        key={todo.id}
                        className={`todo-item ${
                          todo.checked ? "checked" : ""
                        } ${draggedIndex === index ? "dragging" : ""} ${
                          dragOverIndex === index ? "drag-over" : ""
                        }`}
                        draggable={!todo.checked}
                        onDragStart={
                          todo.checked
                            ? undefined
                            : () => handleDragStart(index)
                        }
                        onDragOver={
                          todo.checked
                            ? undefined
                            : (e) => {
                                e.preventDefault();
                                handleDragOver(index);
                              }
                        }
                        onDrop={
                          todo.checked ? undefined : () => handleDrop(index)
                        }
                        onDragEnd={todo.checked ? undefined : handleDragEnd}
                      >
                        <div className="todo-item-content">
                          <button
                            className="todo-checkbox"
                            onClick={() => toggleTodo(todo.id)}
                          >
                            {todo.checked && (
                              <CheckIcon style={{ fontSize: "14px" }} />
                            )}
                          </button>
                          {editingId === todo.id ? (
                            <input
                              id={`todo-edit-${todo.id}`}
                              type="text"
                              className="todo-edit-input"
                              value={todo.text}
                              onChange={(e) =>
                                updateTodoText(todo.id, e.target.value)
                              }
                              onKeyDown={(e) => handleEditKeyPress(e, todo.id)}
                              onBlur={() => setEditingId(null)}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="todo-text"
                              onClick={() => setEditingId(todo.id)}
                            >
                              {todo.text}
                            </span>
                          )}
                          <button
                            className="todo-delete-btn"
                            onClick={() => deleteTodo(todo.id)}
                          >
                            <ClearIcon style={{ fontSize: "14px" }} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </Popper>
    </div>
  );
};
