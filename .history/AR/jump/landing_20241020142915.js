let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let jumpPhase = 'preparation';
let initialFootPosition = null;
let jumpStartTime = 0;
let jumpCompleted = false;
let isModelLoaded = false;

function initializeElements() {
  video = document.getElementById('video3');
  canvas = document.getElementById('output_canvas');
  canvas.width = video.width;
  canvas.height = video.height;
  ctx = canvas.getContext('2d');
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
