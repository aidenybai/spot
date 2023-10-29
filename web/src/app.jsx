import { createRoot } from 'react-dom/client';
import React, { useState, useEffect } from 'react';

export const sendHttp = (action) => {
  const ACTIONS = {
    up: 'W',
    down: 'S',
    left: 'A',
    right: 'D',
    'rotate-left': 'Q',
    'rotate-right': 'E',
    twerk: 'T',
  };

  fetch('https://api.spot.party/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: ACTIONS[action] }),
  });
};

function App() {
  const [needsCooldown, setNeedsCooldown] = useState(false);

  useEffect(() => {
    let timeout;
    if (needsCooldown) {
      timeout = setTimeout(() => setNeedsCooldown(false), 200);
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
            sendHttp('rotate-left');
            setNeedsCooldown(true);
          }}
          name="rotate-left"
        >
          ⤴️
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            sendHttp('up');
            setNeedsCooldown(true);
          }}
          name="up"
        >
          🔼
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            sendHttp('rotate-right');
            setNeedsCooldown(true);
          }}
          name="rotate-right"
        >
          ⤵️
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            sendHttp('left');
            setNeedsCooldown(true);
          }}
          name="left"
        >
          ◀️
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            sendHttp('down');
            setNeedsCooldown(true);
          }}
          name="down"
        >
          🔽
        </Control>
        <Control
          disabled={needsCooldown}
          action={() => {
            sendHttp('right');
            setNeedsCooldown(true);
          }}
          name="right"
        >
          ▶️
        </Control>
      </ArrowKeysLayout>
      <center>
        <Control
          disabled={needsCooldown}
          action={() => {
            sendHttp('twerk');
            setNeedsCooldown(true);
          }}
          name="twerk"
        >
          🍑💦
        </Control>
      </center>
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
        fontSize: '4rem',
        transform: name.startsWith('rotate')
          ? `scale(0.5) rotate(270deg)`
          : null,
      }}
      onClick={action}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

createRoot(document.getElementById('root')).render(<App />);
