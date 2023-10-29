import { createClient } from '@liveblocks/client';

const PUBLIC_KEY =
  'pk_dev_mw05EOQZKCJd6RdCiBxgYvGjSxsq6hOLAGD6eJVp7FmeAq8gOZUntxyjqV1sXr5q';

const client = createClient({
  throttle: 16,
  publicApiKey: PUBLIC_KEY,
});

const { room } = client.enterRoom('spot-party', {
  initialPresence: { cursor: null },
});

const cursorsContainer = document.getElementById('cursors-container');

room.subscribe('my-presence', () => {});
room.subscribe('event', ({ event }) => {
  if (event.type !== 'click') return;
  const el = document.getElementById(event.button);

  requestAnimationFrame(() => {
    el.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.1)', filter: 'brightness(1.1)' },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      {
        duration: 300,
        easing: 'ease-in-out',
      }
    );
  });
});

room.subscribe('others', (others, event) => {
  switch (event.type) {
    case 'reset': {
      cursorsContainer.innerHTML = '';
      for (const user of others) {
        updateCursor(user);
      }
      break;
    }
    case 'leave': {
      deleteCursor(event.user);
      break;
    }
    case 'enter':
    case 'update': {
      updateCursor(event.user);
      break;
    }
  }
});

const root = document.querySelector('#root');

const observer = new MutationObserver(() => {
  requestAnimationFrame(() => {
    document.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        room.broadcastEvent({ type: 'click', button: button.id });
      });
    });
    twemoji.parse(document.body);
  });
});
observer.observe(root, {
  childList: true,
  subtree: true,
});

const cursorUpdate = (e) => {
  e.preventDefault();
  // scale x and y to be between 0 and 1:
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  room.updatePresence({
    cursor: { x, y },
  });
};

document.addEventListener('pointermove', cursorUpdate);
document.addEventListener('touchmove', cursorUpdate);

const COLORS = ['#DC2626', '#D97706', '#059669', '#7C3AED', '#DB2777'];

function updateCursor(user) {
  const cursor = getCursorOrCreate(user.connectionId);

  if (user.presence?.cursor) {
    cursor.style.transform = `translateX(${
      user.presence.cursor.x * window.innerWidth
    }px) translateY(${user.presence.cursor.y * window.innerHeight}px)`;
    cursor.style.opacity = '1';
  } else {
    cursor.style.opacity = '0';
  }
}

function getCursorOrCreate(connectionId) {
  let cursor = document.getElementById(`cursor-${connectionId}`);

  if (cursor == null) {
    cursor = document.getElementById('cursor-template').cloneNode(true);
    cursor.id = `cursor-${connectionId}`;
    cursor.style.fill = COLORS[connectionId % COLORS.length];
    cursorsContainer.appendChild(cursor);
  }

  return cursor;
}

function deleteCursor(user) {
  const cursor = document.getElementById(`cursor-${user.connectionId}`);
  if (cursor) {
    cursor.parentNode.removeChild(cursor);
  }
}
