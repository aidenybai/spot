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
