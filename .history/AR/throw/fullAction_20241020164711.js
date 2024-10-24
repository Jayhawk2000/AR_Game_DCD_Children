let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let throwingStarted = false;
let throwingCompleted = false;
let initialWristPosition = null;
let throwStartTime = null;

function initializeElements() {
  video = document.getElementById('video4');
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
    
    if (!throwingCompleted) {
      checkThrowingPose(results.poseLandmarks);
    }
  }

  ctx.restore();
}

function checkThrowingPose(landmarks) {
  const nose = landmarks[0];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const instructionText = document.getElementById('instruction-text');

  if (!throwingStarted) {
    if (checkSideOnStance(landmarks) && checkArmBehindHead(landmarks)) {
      throwingStarted = true;
      initialWristPosition = leftWrist.x < rightWrist.x ? leftWrist : rightWrist;
      throwStartTime = Date.now();
      instructionText.textContent = "Great! Now perform the throwing motion.";
    } else {
      instructionText.textContent = "Please turn sideways and place one hand behind your head.";
    }
  } else if (leftWrist.x > nose.x && rightWrist.x > nose.x) {
    throwingCompleted = true;
    instructionText.textContent = "Excellent! You've completed the throwing motion.";
    // Here you can add any additional actions or feedback after the throw is completed
  }
}

function checkSideOnStance(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const shoulderDiff = Math.abs(leftShoulder.z - rightShoulder.z);
  const hipDiff = Math.abs(leftHip.z - rightHip.z);

  return shoulderDiff > 0.1 && hipDiff > 0.1;
}

function checkArmBehindHead(landmarks) {
  const nose = landmarks[0];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  return (
    (leftWrist.x < nose.x && leftWrist.y < nose.y) ||
    (rightWrist.x < nose.x && rightWrist.y < nose.y)
  );
}

function startDetection() {
  isDetectionStarted = true;
  camera.start();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  initializeCamera();
  initializePose();
  startDetection();
});

