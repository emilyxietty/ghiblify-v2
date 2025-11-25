import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import React, { useEffect, useRef, useState } from "react";
import InlinePopover from "../../../components/InlinePopover/InlinePopover";
import { useAppContext } from "../../../contexts/AppContext";
import "./Todo.css";

interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

interface TodoProps {
  hideChildren?: boolean;
}

export const Todo: React.FC<TodoProps> = ({ hideChildren }) => {
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
  const titleRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const savedTodos = localStorage.getItem("todo_data");
    if (savedTodos) {
      try {
        const parsed = JSON.parse(savedTodos);
        setTodos(parsed);
      } catch (err) {
        console.error("Failed to parse saved todos:", err);
      }
    }
  }, []);

  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo: TodoItem = {
        id: Date.now().toString(),
        text: inputValue.trim(),
        checked: false,
      };
      setTodos((prev) => {
        const next = [...prev, newTodo];
        try {
          localStorage.setItem("todo_data", JSON.stringify(next));
        } catch (err) {
          console.error("Failed to save todos:", err);
        }
        return next;
      });
      setInputValue("");
    }
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, checked: !t.checked } : t
      );
      try {
        localStorage.setItem("todo_data", JSON.stringify(next));
      } catch (err) {
        console.error("Failed to save todos:", err);
      }
      return next;
    });
  };

  // Persist todos to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("todo_data", JSON.stringify(todos));
    } catch (err) {
      console.error("Failed to save todos:", err);
    }
  }, [todos]);

  const deleteTodo = (id: string) =>
    setTodos((prev) => {
      const next = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem("todo_data", JSON.stringify(next));
      } catch (err) {
        console.error("Failed to save todos:", err);
      }
      return next;
    });

  const updateTodoText = (id: string, newText: string) => {
    setTodos((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, text: newText } : t));
      try {
        localStorage.setItem("todo_data", JSON.stringify(next));
      } catch (err) {
        console.error("Failed to save todos:", err);
      }
      return next;
    });
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
    setTodos(() => {
      try {
        localStorage.setItem("todo_data", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save todos:", err);
      }
      return updated;
    });
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
        className="todo-header"
        ref={headerRef}
        aria-expanded={!todoCollapsed}
      >
        <InlinePopover
          trigger={
            <span
              className="todo-title-text"
              onClick={() => updateTodoCollapsed(!todoCollapsed)}
              style={{ cursor: "pointer" }}
            >
              Todo
            </span>
          }
          align="start"
          closeOnOutsideClick={false}
          isOpen={!todoCollapsed}
          inline={true}
          onOpen={() => updateTodoCollapsed(false)}
          onClose={() => updateTodoCollapsed(true)}
          disabled={
            isDragging ||
            (headerRef.current?.closest(".widget") as HTMLElement | null)
              ?.dataset.justDragged === "true"
          }
        >
          {!isDragging && !hideChildren && (
            <div className="todo-popover" style={{ width: `${width}px` }}>
              <div style={{ width: "100%" }}>
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
              </div>
            </div>
          )}
        </InlinePopover>
      </div>
    </div>
  );
};
