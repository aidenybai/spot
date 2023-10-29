import Handsfree from 'handsfree';

const handsfree = new Handsfree({
  debug: true,
  pose: {
    enabled: true,
    upperBodyOnly: true,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  },
});

handsfree.start();

let lastAverage;

document.addEventListener('handsfree-data', (event) => {
  const data = event.detail;
  if (!data.pose) return;
  if (!data.pose.poseLandmarks) return;

  const landmarkIndicies = [11, 12, 13, 14];

  const x = landmarkIndicies.map((i) => data.pose.poseLandmarks[i].x);
  const y = landmarkIndicies.map((i) => data.pose.poseLandmarks[i].y);
  const avgX = x.reduce((a, b) => a + b, 0) / x.length;
  const avgY = y.reduce((a, b) => a + b, 0) / y.length;

  // check if y (of shoulders — 11, 12) is at like 10% of total — if user is squatting, spot should twerk
  if (data.pose.poseLandmarks[11].y < 0.15) {
    console.log('squat');
    // sendHttp('squat');
  } 

  if (lastAverage) {
    const diffX = avgX - lastAverage[0];
    const diffY = avgY - lastAverage[1];
    const diff = Math.sqrt(diffX * diffX + diffY * diffY);
    if (diff > 0.05) {
      console.log('diff', diff);
      if (diffX > 0.05) {
        console.log('right');
        // sendHttp('right');
      } else if (diffX < -0.05) {
        console.log('left');
        // sendHttp('left');
      } else if (diffY > 0.05) {
        console.log('down');
        // sendHttp('down');
      } else if (diffY < -0.05) {
        console.log('up');
        // sendHttp('up');
      }
    }
  }

  lastAverage = [avgX, avgY];
});
