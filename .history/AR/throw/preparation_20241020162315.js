const { Camera } = window;
const { Pose, POSE_CONNECTIONS } = window;
const { drawConnectors, drawLandmarks } = window;

let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let preparationPoseDetected = false;

function initializeElements() {
  video = document.getElementById('video1');
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

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
    
    checkSideOnStance(results.poseLandmarks);
  }

  ctx.restore();
}

function checkSideOnStance(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const shoulderDiff = Math.abs(leftShoulder.z - rightShoulder.z);
  const hipDiff = Math.abs(leftHip.z - rightHip.z);

  const feedbackTextElement = document.getElementById('feedback-text');

  if (shoulderDiff > 0.1 && hipDiff > 0.1) {
    feedbackTextElement.textContent = "Great! You are in the correct side-on stance.";
  } else {
    feedbackTextElement.textContent = "Please turn sideways to the camera.";
  }
}

function startDetection() {
  isDetectionStarted = true;
  camera.start();
}

// Initialize elements and start detection when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  initializeElements();
  initializeCamera();
  initializePose();
  startDetection();
  console.log('Detection started');
});
