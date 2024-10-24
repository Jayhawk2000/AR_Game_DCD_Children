let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let initialFootPosition = null;

class JumpDetector {
  constructor() {
    this.isInStartingPosition = false;
    this.startingPositionHoldTime = 0;
    this.STARTING_POSITION_HOLD_DURATION = 2000;
    this.jumpStarted = false;
    this.jumpCompleted = false;
    this.initialFootPosition = null;
    this.highestPoint = null;
    this.jumpStartTime = 0;
    this.jumpDetectionStarted = false;
    this.minimumJumpHeight = 0.05;
    this.maximumJumpDuration = 2000;
  }

  checkStartingPosition(landmarks) {
    const instructionText = document.getElementById('instruction-text');
    const isFeetApart = this.checkFeetApart(landmarks);
    const isBentKnees = this.checkBentKnees(landmarks);

    if (isFeetApart && isBentKnees) {
      const currentTime = Date.now();
      if (this.startingPositionHoldTime === 0) {
        this.startingPositionHoldTime = currentTime;
      } else {
        const elapsedTime = currentTime - this.startingPositionHoldTime;
        if (elapsedTime >= this.STARTING_POSITION_HOLD_DURATION) {
          this.isInStartingPosition = true;
          instructionText.textContent = "Starting position held. Jump now!";
          this.initialFootPosition = this.getFootPosition(landmarks);
        } else {
          instructionText.textContent = "Hold this position...";
        }
      }
    } else {
      this.startingPositionHoldTime = 0;
      if (!isFeetApart) {
        instructionText.textContent = "Stand with feet slightly apart";
      } else if (!isBentKnees) {
        instructionText.textContent = "Bend your knees slightly";
      }
    }
  }

  checkFeetApart(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const distance = Math.abs(leftAnkle.x - rightAnkle.x);
    return distance > 0.1 && distance < 0.3;
  }

  checkBentKnees(landmarks) {
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];

    const leftKneeAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle);

    return leftKneeAngle < 170 && rightKneeAngle < 170;
  }

  getFootPosition(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    return { left: leftAnkle, right: rightAnkle };
  }

  checkJumpingMotion(landmarks) {
    const instructionText = document.getElementById('instruction-text');
    const currentTime = Date.now();

    if (!this.jumpDetectionStarted) {
      const currentFootPosition = this.getFootPosition(landmarks);
      if (
        currentFootPosition.left.y < this.initialFootPosition.left.y - this.minimumJumpHeight &&
        currentFootPosition.right.y < this.initialFootPosition.right.y - this.minimumJumpHeight
      ) {
        this.jumpDetectionStarted = true;
        this.jumpStarted = true;
        this.highestPoint = null;
        this.jumpStartTime = currentTime;
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
