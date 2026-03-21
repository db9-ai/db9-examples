'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initAndLoad();
  }, []);

  async function initAndLoad() {
    try {
      await fetch('/api/init', { method: 'POST' });
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.trim() }),
    });
    const todo = await res.json();
    if (res.ok) {
      setTodos([todo, ...todos]);
      setInput('');
    }
  }

  async function toggleTodo(id, completed) {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTodos(todos.map(t => t.id === id ? updated : t));
    }
  }

  async function deleteTodo(id) {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTodos(todos.filter(t => t.id !== id));
    }
  }

  if (loading) return <Main><p>Loading...</p></Main>;
  if (error) return <Main><p style={{ color: 'red' }}>Error: {error}</p></Main>;

  return (
    <Main>
      <h1 style={{ margin: '0 0 8px', fontSize: '24px' }}>Todo App</h1>
      <p style={{ margin: '0 0 24px', color: '#666', fontSize: '14px' }}>
        Powered by <a href="https://db9.ai" style={{ color: '#0070f3' }}>db9</a> + Next.js
      </p>

      <form onSubmit={addTodo} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="What needs to be done?"
          style={{
            flex: 1, padding: '10px 14px', fontSize: '16px',
            border: '1px solid #ddd', borderRadius: '8px', outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 20px', fontSize: '16px', background: '#0070f3',
            color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
          }}
        >
          Add
        </button>
      </form>

      {todos.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '32px 0' }}>
          No todos yet. Add one above!
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {todos.map(todo => (
            <li
              key={todo.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', background: 'white', borderRadius: '8px',
                marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id, todo.completed)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{
                flex: 1, fontSize: '16px',
                textDecoration: todo.completed ? 'line-through' : 'none',
                color: todo.completed ? '#999' : '#333',
              }}>
                {todo.title}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                style={{
                  background: 'none', border: 'none', color: '#ccc',
                  fontSize: '18px', cursor: 'pointer', padding: '4px 8px',
                }}
                onMouseOver={e => e.target.style.color = '#ff4444'}
                onMouseOut={e => e.target.style.color = '#ccc'}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '24px', color: '#999', fontSize: '12px', textAlign: 'center' }}>
        {todos.length} todo{todos.length !== 1 ? 's' : ''} | {todos.filter(t => t.completed).length} completed
      </p>
    </Main>
  );
}

function Main({ children }) {
  return (
    <div style={{
      maxWidth: '560px', margin: '48px auto', padding: '32px',
      background: 'white', borderRadius: '12px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    }}>
      {children}
    </div>
  );
}
