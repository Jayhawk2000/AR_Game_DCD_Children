let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let armExtendedDetected = false;
let armExtendedTimer = null;
let canDetectAgain = true;

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

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
    
    checkArmExtended(results.poseLandmarks);
  }

  ctx.restore();
}

function checkArmExtended(landmarks) {
  if (!canDetectAgain) return;

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const instructionText = document.getElementById('instruction-text');

  // Check if either arm is extended from behind the head
  const leftArmExtended = (leftWrist.x < nose.x && leftWrist.y < nose.y) && 
                          (leftElbow.x > leftWrist.x && leftElbow.y > leftWrist.y);
  const rightArmExtended = (rightWrist.x > nose.x && rightWrist.y < nose.y) && 
                           (rightElbow.x < rightWrist.x && rightElbow.y > rightWrist.y);

  if (leftArmExtended || rightArmExtended) {
    if (!armExtendedDetected) {
      armExtendedDetected = true;
      instructionText.textContent = "Great! You've extended your arm from behind your head.";
      startArmExtendedTimer();
    }
  } else {
    armExtendedDetected = false;
    instructionText.textContent = "Please extend your arm from behind your head.";
  }
}

function startArmExtendedTimer() {
  canDetectAgain = false;
  armExtendedTimer = setTimeout(() => {
    resetDetection();
  }, 1000);
}

function resetDetection() {
  armExtendedDetected = false;
  canDetectAgain = true;
  const instructionText = document.getElementById('instruction-text');
  instructionText.textContent = "Let's try that again. Extend your arm from behind your head.";
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
