import { createClient } from '@liveblocks/client';

let PUBLIC_KEY =
  'pk_dev_mw05EOQZKCJd6RdCiBxgYvGjSxsq6hOLAGD6eJVp7FmeAq8gOZUntxyjqV1sXr5q';
let roomId = 'javascript-live-cursors';

overrideApiKeyAndRoomId();

if (!/^pk_(live|test)/.test(PUBLIC_KEY)) {
  console.warn(
    `Replace "${PUBLIC_KEY}" by your public key from https://liveblocks.io/dashboard/apikeys.\n` +
      `Learn more: https://github.com/liveblocks/liveblocks/tree/main/examples/javascript-live-cursors#getting-started.`
  );
}

const client = createClient({
  throttle: 16,
  publicApiKey: PUBLIC_KEY,
});

// If you no longer need the room (for example when you unmount your
// component), make sure to call leave()
const { room, leave } = client.enterRoom(roomId, {
  initialPresence: { cursor: null },
});

const cursorsContainer = document.getElementById('cursors-container');

room.subscribe('my-presence', () => {});

room.subscribe('event', ({ event }) => {
  if (event.type !== 'click') return;
  const el = document.getElementById(event.button);

  const keyframes = [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.1)', filter: 'brightness(1.1)' },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ];

  const options = {
    duration: 300,
    easing: 'ease-in-out',
  };

  requestAnimationFrame(() => {
    el.animate(keyframes, options);
  });
});

/**
 * Subscribe to every others presence updates.
 * The callback will be called if you or someone else enters or leaves the room
 * or when someone presence is updated
 */
room.subscribe('others', (others, event) => {
  switch (event.type) {
    case 'reset': {
      // Clear all cursors
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

setTimeout(() => {
  document.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      room.broadcastEvent({ type: 'click', button: button.id });
    });
  });
  twemoji.parse(document.body);
}, 1000);

document.addEventListener('pointermove', (e) => {
  e.preventDefault();
  // scale x and y to be between 0 and 1:
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  room.updatePresence({
    cursor: { x, y },
  });
});

document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  room.updatePresence({
    cursor: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
  });
});

const COLORS = ['#DC2626', '#D97706', '#059669', '#7C3AED', '#DB2777'];

// Update cursor position based on user presence
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

/**
 * This function is used when deploying an example on liveblocks.io.
 * You can ignore it completely if you run the example locally.
 */
function overrideApiKeyAndRoomId() {
  const query = new URLSearchParams(window?.location?.search);
  const apiKey = query.get('apiKey');
  const roomIdSuffix = query.get('roomId');

  if (apiKey) {
    PUBLIC_KEY = apiKey;
  }

  if (roomIdSuffix) {
    roomId = `${roomId}-${roomIdSuffix}`;
  }
}
