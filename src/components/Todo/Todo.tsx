import React, { useEffect, useRef, useState } from "react";
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
  const [width, setWidth] = useState(() => {
    return parseInt(localStorage.getItem("todo_width") || "350");
  });
  const inputRef = useRef<HTMLInputElement>(null);

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
    const handleSettingsChange = (e: CustomEvent) => {
      if (e.detail.width) {
        setWidth(e.detail.width);
      }
    };

    window.addEventListener(
      "todoSettingsChange",
      handleSettingsChange as EventListener
    );
    return () => {
      window.removeEventListener(
        "todoSettingsChange",
        handleSettingsChange as EventListener
      );
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

  return (
    <div
      className="todo-container"
      onMouseDown={handleMouseDown}
      style={{ width: `${width}px` }}
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
          {sortedTodos.map((todo) => (
            <li
              key={todo.id}
              className={`todo-item ${todo.checked ? "checked" : ""}`}
            >
              <div className="todo-item-content">
                <button
                  className="todo-checkbox"
                  onClick={() => toggleTodo(todo.id)}
                >
                  {todo.checked && "✓"}
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
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
