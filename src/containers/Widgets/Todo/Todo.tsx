import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
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
  const { todoSettings, todoCollapsed, updateTodoCollapsed } = useAppContext();
  const width = todoSettings.width;
  const height = todoSettings.height;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const darkMode = todoSettings.darkMode;

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

  // Save todos to localStorage whenever they change
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
      setTodos([...todos, newTodo]);
      setInputValue("");
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, checked: !todo.checked } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const updateTodoText = (id: string, newText: string) => {
    setTodos(
      todos.map((todo) => (todo.id === id ? { ...todo, text: newText } : todo))
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  const handleEditKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string
  ) => {
    if (e.key === "Enter") {
      setEditingId(null);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  // Prevent drag when clicking inside todo container
  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow dragging when the user clicks the header; only stop propagation
    // for clicks inside the body/content of the widget.
    const target = e.target as HTMLElement | null;
    // debug: log what element was clicked and whether it's inside the header
    // (remove these logs after debugging)
    // eslint-disable-next-line no-console
    console.debug(
      "Todo.handleMouseDown target:",
      target,
      "closest(.todo-header):",
      target?.closest?.(".todo-header")
    );
    if (target && target.closest && target.closest(".todo-header")) {
      // do not stop propagation -> allow widget drag to start
      return;
    }
    e.stopPropagation();
  };

  // Sort todos: unchecked first, then checked
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.checked === b.checked) return 0;
    return a.checked ? 1 : -1;
  });

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index: number) => {
    setDragOverIndex(index);
  };

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
      className={`todo-container${darkMode ? " todo-dark" : ""}${
        !open ? " collapsed" : ""
      }`}
      onMouseDown={handleMouseDown}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minHeight: `${height}px`,
        boxSizing: "border-box",
      }}
    >
      <div
        className="todo-header"
        role="button"
        tabIndex={0}
        aria-expanded={!todoCollapsed}
        onClick={() => updateTodoCollapsed(!todoCollapsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ")
            updateTodoCollapsed(!todoCollapsed);
        }}
      >
        <span className="todo-title-text">Todo</span>
        {!todoCollapsed && (
          <span className="todo-hover-label" aria-hidden="true">
            (hide)
          </span>
        )}
      </div>

      {!todoCollapsed && (
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
                  className={`todo-item ${todo.checked ? "checked" : ""} ${
                    draggedIndex === index ? "dragging" : ""
                  } ${dragOverIndex === index ? "drag-over" : ""}`}
                  draggable={!todo.checked}
                  onDragStart={
                    todo.checked ? undefined : () => handleDragStart(index)
                  }
                  onDragOver={
                    todo.checked
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          handleDragOver(index);
                        }
                  }
                  onDrop={todo.checked ? undefined : () => handleDrop(index)}
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
  );
};
