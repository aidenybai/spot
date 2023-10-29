import Handsfree from 'handsfree';
const handsfree = new Handsfree({
  pose: {
    enabled: true,
    upperBodyOnly: true,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  },
});

handsfree.start();

// From an event
document.addEventListener('handsfree-data', (event) => {
  const data = event.detail;
  if (!data.pose) return;

  console.log(data.pose.poseLandmarks);
});
