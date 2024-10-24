let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let jumpDetected = false;
let initialFootPosition = null;
let lastJumpTime = 0;

// 添加状态管理
let currentPhase = 'preparation'; // preparation -> propulsion -> jump -> landing
let phaseStartTime = 0;
const PHASE_DURATION = 1000; // 每个阶段最少持续时间

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
    
    checkJump(results.poseLandmarks);
  }

  ctx.restore();
}

function checkJump(landmarks) {
  const instructionText = document.getElementById('instruction-text');
  const currentTime = Date.now();

  switch(currentPhase) {
    case 'preparation':
      if (checkPreparationPose(landmarks)) {
        if (phaseStartTime === 0) {
          phaseStartTime = currentTime;
        } else if (currentTime - phaseStartTime > PHASE_DURATION) {
          currentPhase = 'propulsion';
          phaseStartTime = 0;
          instructionText.textContent = "Good! Now push off!";
        }
      } else {
        phaseStartTime = 0;
        instructionText.textContent = "Bend your knees and prepare to jump";
      }
      break;

    case 'propulsion':
      if (checkPropulsionPose(landmarks)) {
        if (phaseStartTime === 0) {
          phaseStartTime = currentTime;
        } else if (currentTime - phaseStartTime > PHASE_DURATION) {
          currentPhase = 'jump';
          phaseStartTime = 0;
          instructionText.textContent = "Jump!";
        }
      } else {
        phaseStartTime = 0;
      }
      break;

    case 'jump':
      if (checkJumping(landmarks)) {
        currentPhase = 'landing';
        instructionText.textContent = "Great! Now land softly!";
      }
      break;

    case 'landing':
      if (checkLanding(landmarks)) {
        instructionText.textContent = "Perfect landing! You've completed the full action!";
        setTimeout(() => {
          resetJumpDetection();
        }, 2000);
      }
      break;
  }
}

function resetJumpDetection() {
  currentPhase = 'preparation';
  phaseStartTime = 0;
  jumpDetected = false;
  initialFootPosition = null;
}

function checkPreparationPose(landmarks) {
  const leftHip = landmarks[23];
  const leftKnee = landmarks[25];
  const leftAnkle = landmarks[27];
  const rightHip = landmarks[24];
  const rightKnee = landmarks[26];
  const rightAnkle = landmarks[28];

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  return leftKneeAngle < 150 && rightKneeAngle < 150;
}

function checkPropulsionPose(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (!initialFootPosition) {
    initialFootPosition = (leftAnkle.y + rightAnkle.y) / 2;
    return false;
  }

  const currentFootPosition = (leftAnkle.y + rightAnkle.y) / 2;
  const jumpThreshold = 0.05;

  return currentFootPosition < initialFootPosition - jumpThreshold;
}

function checkJumping(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (!initialFootPosition) {
    initialFootPosition = (leftAnkle.y + rightAnkle.y) / 2;
    return false;
  }

  const currentFootPosition = (leftAnkle.y + rightAnkle.y) / 2;
  const jumpThreshold = 0.05;

  return currentFootPosition < initialFootPosition - jumpThreshold;
}

function checkLanding(landmarks) {
  const leftHip = landmarks[23];
  const leftKnee = landmarks[25];
  const leftAnkle = landmarks[27];
  const rightHip = landmarks[24];
  const rightKnee = landmarks[26];
  const rightAnkle = landmarks[28];

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  return leftKneeAngle < 150 && rightKneeAngle < 150;
}

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
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

init();
