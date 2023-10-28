import { createRoot } from 'react-dom/client';
import React, { useState, useEffect } from 'react';

function App() {
  const [needsCooldown, setNeedsCooldown] = useState(false);

  useEffect(() => {
    let timeout;
    if (needsCooldown) {
      timeout = setTimeout(() => setNeedsCooldown(false), 750);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [needsCooldown]);

  return (
    <div>
      <ArrowKeysLayout>
        <Control
          disabled={needsCooldown}
          action={() => {
            setNeedsCooldown(true);
          }}
          name="rotate-left"
        >
          ↩️
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            setNeedsCooldown(true);
          }}
          name="up"
        >
          🔼
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            setNeedsCooldown(true);
          }}
          name="rotate-right"
        >
          ↪️
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            setNeedsCooldown(true);
          }}
          name="left"
        >
          ◀️
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            setNeedsCooldown(true);
          }}
          name="down"
        >
          🔽
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            setNeedsCooldown(true);
          }}
          name="right"
        >
          ▶️
        </Control>
      </ArrowKeysLayout>
    </div>
  );
}

function ArrowKeysLayout({ children }) {
  return (
    <div
      style={{
        display: 'grid',
        columnGap: '1rem',
        gridTemplateColumns: '1fr 1fr 1fr',
      }}
    >
      {children}
    </div>
  );
}

function Control({ children, action, name, disabled }) {
  return (
    <button
      id={name}
      style={{
        padding: '0rem',
        fontSize: name.startsWith('rotate') ? '2rem' : '4rem',
      }}
      onClick={action}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

createRoot(document.getElementById('root')).render(<App />);
