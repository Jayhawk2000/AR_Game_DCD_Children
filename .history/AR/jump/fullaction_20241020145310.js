let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let jumpDetected = false;
let initialFootPosition = null;

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
  
  const isBentKnees = checkBentKnees(landmarks);
  const isJumping = checkJumping(landmarks);

  if (!jumpDetected && isBentKnees) {
    instructionText.textContent = "Good! Now jump!";
  } else if (!jumpDetected && isJumping) {
    jumpDetected = true;
    instructionText.textContent = "Great jump! You've completed the full action!";
  } else if (!isBentKnees && !isJumping) {
    instructionText.textContent = "Bend your knees and prepare to jump";
  }
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

  return leftKneeAngle < 150 && rightKneeAngle < 150;
}

function checkJumping(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (!initialFootPosition) {
    initialFootPosition = (leftAnkle.y + rightAnkle.y) / 2;
    return false;
  }

  const currentFootPosition = (leftAnkle.y + rightAnkle.y) / 2;
  const jumpThreshold = 0.05; // Adjust this value as needed

  return currentFootPosition < initialFootPosition - jumpThreshold;
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
