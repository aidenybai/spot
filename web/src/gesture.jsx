import Handsfree from 'handsfree';
import { sendHttp } from './http';

const handsfree = new Handsfree({
  hands: {
    enabled: true,
    maxNumHands: 4,
  },
});

handsfree.useGesture({
  name: 'left',
  algorithm: 'fingerpose',
  models: 'hands',
  confidence: 7.5,
  description: [
    ['addCurl', 'Thumb', 'NoCurl', 1],
    ['addDirection', 'Thumb', 'DiagonalUpRight', 1],
    ['addDirection', 'Thumb', 'VerticalUp', 0.16],
    ['addDirection', 'Thumb', 'HorizontalRight', 0.04],
    ['addCurl', 'Index', 'NoCurl', 1],
    ['addDirection', 'Index', 'DiagonalUpRight', 1],
    ['addCurl', 'Middle', 'NoCurl', 1],
    ['addDirection', 'Middle', 'HorizontalRight', 1],
    ['addCurl', 'Ring', 'NoCurl', 1],
    ['addDirection', 'Ring', 'HorizontalRight', 1],
    ['addCurl', 'Pinky', 'FullCurl', 1],
    ['addCurl', 'Pinky', 'NoCurl', 0.20833333333333334],
    ['addCurl', 'Pinky', 'HalfCurl', 0.041666666666666664],
    ['addDirection', 'Pinky', 'HorizontalRight', 1],
  ],
});

handsfree.useGesture({
  name: 'right',
  algorithm: 'fingerpose',
  models: 'hands',
  confidence: 7.5,
  description: [
    ['addCurl', 'Thumb', 'NoCurl', 1],
    ['addDirection', 'Thumb', 'DiagonalUpLeft', 1],
    ['addCurl', 'Index', 'NoCurl', 1],
    ['addDirection', 'Index', 'HorizontalLeft', 1],
    ['addCurl', 'Middle', 'NoCurl', 1],
    ['addDirection', 'Middle', 'HorizontalLeft', 1],
    ['addCurl', 'Ring', 'NoCurl', 1],
    ['addDirection', 'Ring', 'HorizontalLeft', 1],
    ['addCurl', 'Pinky', 'NoCurl', 1],
    ['addDirection', 'Pinky', 'HorizontalLeft', 1],
  ],
});

handsfree.useGesture({
  name: 'forward',
  algorithm: 'fingerpose',
  models: 'hands',
  confidence: 7.5,
  description: [
    ['addCurl', 'Thumb', 'HalfCurl', 1],
    ['addDirection', 'Thumb', 'VerticalUp', 1],
    ['addCurl', 'Index', 'FullCurl', 1],
    ['addDirection', 'Index', 'DiagonalUpRight', 1],
    ['addCurl', 'Middle', 'FullCurl', 1],
    ['addDirection', 'Middle', 'DiagonalUpRight', 0.30434782608695654],
    ['addDirection', 'Middle', 'VerticalUp', 1],
    ['addCurl', 'Ring', 'FullCurl', 1],
    ['addDirection', 'Ring', 'VerticalUp', 1],
    ['addCurl', 'Pinky', 'FullCurl', 1],
    ['addDirection', 'Pinky', 'VerticalUp', 1],
    ['addDirection', 'Pinky', 'DiagonalUpLeft', 0.6666666666666666],
  ],
  enabled: true,
});

handsfree.start();

let interval;
let direction;
let consensus;
document.addEventListener('handsfree-data', (event) => {
  const data = event.detail;
  if (!data.hands || !data.hands?.gesture || !data.hands?.gesture?.[0]) {
    if (interval) clearInterval(interval);
    return;
  }

  switch (data.hands.gesture[0]) {
    case 'left':
      direction = 'left';
      break;
    case 'right':
      direction = 'right';
      break;
    case 'forward':
      direction = 'up';
      break;
  }
  const cb = () => {
    if (direction === 'right') {
      sendHttp('right');
    } else if (direction === 'left') {
      sendHttp('left');
    } else if (direction === 'up') {
      sendHttp('up');
    }
  };
  interval = setInterval(cb, 1000);
  cb();
});

console.log(handsfree);
