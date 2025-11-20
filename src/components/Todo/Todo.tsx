import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import React, { useEffect, useRef, useState } from "react";
import "./Todo.css";

interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

interface TodoProps {
  //   darkMode?: boolean;
}

export const Todo: React.FC<TodoProps> = ({}) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [width, setWidth] = useState(() => {
    return parseInt(localStorage.getItem("todo_width") || "350");
  });
  const [height, setHeight] = useState(() => {
    return parseInt(localStorage.getItem("todo_height") || "500");
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("todo_darkMode");
    return saved ? saved === "true" : false;
  });

  // Load todos from localStorage on mount
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

    // Listen for custom settings change event
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.width !== undefined) {
        setWidth(customEvent.detail.width);
        localStorage.setItem("todo_width", customEvent.detail.width.toString());
      }
      if (customEvent.detail.height !== undefined) {
        setHeight(customEvent.detail.height);
        localStorage.setItem(
          "todo_height",
          customEvent.detail.height.toString()
        );
      }
    };

    window.addEventListener("todoSettingsChange", handleSettingsChange);
    return () => {
      window.removeEventListener("todoSettingsChange", handleSettingsChange);
    };
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

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem("todo_darkMode");
      setDarkMode(saved === "true");
    };
    window.addEventListener("todoSettingsChange", handler);
    return () => window.removeEventListener("todoSettingsChange", handler);
  }, []);

  return (
    <div
      className={`todo-container${darkMode ? " todo-dark" : ""}`}
      onMouseDown={handleMouseDown}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minHeight: `${height}px`,
        boxSizing: "border-box",
      }}
    >
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
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => {
                e.preventDefault();
                handleDragOver(index);
              }}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <div className="todo-item-content">
                <button
                  className="todo-checkbox"
                  onClick={() => toggleTodo(todo.id)}
                >
                  {todo.checked && <CheckIcon style={{ fontSize: "14px" }} />}
                </button>
                {editingId === todo.id ? (
                  <input
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
  );
};
