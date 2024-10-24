let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;

function initializeElements() {
  video = document.getElementById('video2');
  canvas = document.createElement('canvas');
  canvas.width = video.width;
  canvas.height = video.height;
  ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
}

function initializeCamera() {
  camera = new Camera(video, {
    onFrame: async () => {
      if (pose && isDetectionStarted) {
        await pose.send({image: video});
      }
    },
    width: 1280,
    height: 720
  });
}

function initializePose() {
  pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
  });
  
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(onResults);
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
    
    checkLiftOneFoot(results.poseLandmarks);
  }

  ctx.restore();
}

function checkLiftOneFoot(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const footDifference = Math.abs(leftAnkle.y - rightAnkle.y);
  const oneFootLifted = footDifference > 0.1;

  const instructionText = document.getElementById('instruction-text');
  if (oneFootLifted) {
    instructionText.textContent = "Great! Keep one foot lifted.";
  } else {
    instructionText.textContent = "Lift one foot off the ground.";
  }
}

async function startDetection() {
  await camera.start();
  isDetectionStarted = true;
}

function init() {
  initializeElements();
  initializeCamera();
  initializePose();
  startDetection();
}

document.addEventListener('DOMContentLoaded', init);

