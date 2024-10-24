let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let handBehindHeadDetected = false;

function initializeElements() {
  video = document.getElementById('video2');
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
    
    checkHandBehindHead(results.poseLandmarks);
  }

  ctx.restore();
}

function checkHandBehindHead(landmarks) {
  const nose = landmarks[0];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const instructionText = document.getElementById('instruction-text');

  if ((leftWrist.x < nose.x && leftWrist.y < nose.y) || (rightWrist.x < nose.x && rightWrist.y < nose.y)) {
    if (!handBehindHeadDetected) {
      handBehindHeadDetected = true;
      instructionText.textContent = "Great! You've placed your hand behind your head.";
    }
  } else {
    handBehindHeadDetected = false;
    instructionText.textContent = "Please place one hand behind your head.";
  }
}

function startDetection() {
  isDetectionStarted = true;
  camera.start();
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  initializeElements();
  initializeCamera();
  initializePose();
  startDetection();
  console.log('Detection started');
});

