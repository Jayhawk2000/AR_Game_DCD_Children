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

  pose.initialize().then(() => {
    isModelLoaded = true;
    document.getElementById('loading-text').style.display = 'none';
    startDetection();
  });
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
    
    checkJumpPhase(results.poseLandmarks);
  }

  ctx.restore();
}

function checkJumpPhase(landmarks) {
  if (!isDetectionStarted) return;
  
  const instructionText = document.getElementById('instruction-text');
  
  if (jumpPhase === 'preparation') {
    if (checkStartingPosition(landmarks)) {
      jumpPhase = 'jump';
      initialFootPosition = getFootPosition(landmarks);
      instructionText.textContent = "Great! Now jump!";
    } else {
      instructionText.textContent = "Bend your knees and prepare to jump.";
    }
  } else if (jumpPhase === 'jump' && !jumpCompleted) {
    checkJump(landmarks);
  }
}

function checkStartingPosition(landmarks) {
  return checkFeetApart(landmarks) && checkBentKnees(landmarks);
}

function checkFeetApart(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const distance = Math.abs(leftAnkle.x - rightAnkle.x);
  return distance > 0.1 && distance < 0.3;
}

function checkBentKnees(landmarks) {
  const leftHip = landmarks[23];
  const leftKnee = landmarks[25];
  const leftAnkle = landmarks[27];
  const rightHip = landmarks[24];
  const rightKnee = landmarks[26];
  const rightAnkle = landmarks[28];

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  return leftKneeAngle < 170 && rightKneeAngle < 170;
}

function getFootPosition(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  return { left: leftAnkle, right: rightAnkle };
}

function checkJump(landmarks) {
  const currentFootPosition = getFootPosition(landmarks);
  const jumpHeight = Math.min(
    initialFootPosition.left.y - currentFootPosition.left.y,
    initialFootPosition.right.y - currentFootPosition.right.y
  );

  if (jumpHeight > 0.05 && !jumpStartTime) {
    jumpStartTime = Date.now();
    document.getElementById('instruction-text').textContent = "Good jump! Now land softly.";
  } else if (jumpStartTime && Date.now() - jumpStartTime > 2000) {
    jumpCompleted = true;
    document.getElementById('instruction-text').textContent = "Great job! You've completed the jump!";
  }
}

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function init() {
  initializeElements();
  initializeCamera();
  initializePose();
  startDetection();
}

async function startDetection() {
  await camera.start();
  isDetectionStarted = true;
  pose.send({image: video});
}

function updateLoadingProgress(progress) {
  document.getElementById('loading-text').textContent = `Loading model... ${Math.round(progress * 100)}%`;
}

document.addEventListener('DOMContentLoaded', init);
