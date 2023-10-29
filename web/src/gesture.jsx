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

handsfree.start();

let interval;
let direction;
let consensus;
document.addEventListener('handsfree-data', (event) => {
  const data = event.detail;
  if (!data.hands || !data.hands?.gesture) return;

  consensus = 0;
  for (const gesture of data.hands.gesture) {
    if (!gesture) continue;
    if (gesture.name === 'left') consensus--;
    if (gesture.name === 'right') consensus++;
  }

  if (consensus > 0) {
    if (direction === 'left') {
      clearInterval(interval);
      interval = undefined;
    }
    direction = 'right';
  } else if (consensus < 0) {
    if (direction === 'right') {
      clearInterval(interval);
      interval = undefined;
    }
    direction = 'left';
  }

  if (interval) return;
  interval = setInterval(() => {
    if (direction === 'right') {
      sendHttp('right');
    } else if (direction === 'left') {
      sendHttp('left');
    }
  }, 1000);
});

console.log(handsfree);
