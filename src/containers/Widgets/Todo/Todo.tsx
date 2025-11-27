import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import React, { useEffect, useRef, useState } from "react";
import TextInput from "../../../components/TextInput/TextInput";
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
  const { todoSettings } = useAppContext();
  const width = todoSettings.width;
  const height = todoSettings.height;
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Drag-and-drop reordering logic
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };
  const handleDragOver = (index: number) => {
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...todos];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);
    setTodos(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
    try {
      localStorage.setItem("todo_data", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save todos:", err);
    }
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const sortedTodos = [...todos].sort((a, b) =>
    a.checked === b.checked ? 0 : a.checked ? 1 : -1
  );

  return (
    <div
      className={`todo-container widget-header ${
        todoSettings.darkMode ? "todo-dark" : ""
      }`}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <div className="todo-input-wrapper">
        <TextInput
          ref={inputRef}
          type="text"
        //   className="todo-input"
          placeholder="Add a task..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          mode={todoSettings.darkMode ? "dark" : "light"}
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
                  <TextInput
                    id={`todo-edit-${todo.id}`}
                    type="text"
                    className="todo-edit-input"
                    value={todo.text}
                    onChange={(e) => updateTodoText(todo.id, e.target.value)}
                    onKeyDown={(e) => handleEditKeyPress(e, todo.id)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                    mode={todoSettings.darkMode ? "dark" : "light"}
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
