let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let propulsionPoseDetected = false;

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
    
    checkPropulsionPose(results.poseLandmarks);
  }

  ctx.restore();
}

function checkPropulsionPose(landmarks) {
  const instructionText = document.getElementById('instruction-text');
  
  const areStraightLegs = checkStraightLegs(landmarks);
  const areArmsForward = checkArmsForward(landmarks);

  if (areStraightLegs && areArmsForward) {
    if (!propulsionPoseDetected) {
      propulsionPoseDetected = true;
      instructionText.textContent = "Great! You've achieved the propulsion pose!";
    }
  } else {
    propulsionPoseDetected = false;
    if (!areStraightLegs) {
      instructionText.textContent = "Straighten your legs more.";
    } else if (!areArmsForward) {
      instructionText.textContent = "Swing your arms forward and upward.";
    }
  }
}

function checkStraightLegs(landmarks) {
  const leftHip = landmarks[23];
  const leftKnee = landmarks[25];
  const leftAnkle = landmarks[27];
  const rightHip = landmarks[24];
  const rightKnee = landmarks[26];
  const rightAnkle = landmarks[28];

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  return leftKneeAngle > 160 && rightKneeAngle > 160;
}

function checkArmsForward(landmarks) {
  const leftShoulder = landmarks[11];
  const leftWrist = landmarks[15];
  const rightShoulder = landmarks[12];
  const rightWrist = landmarks[16];

  return (leftWrist.y < leftShoulder.y) && (rightWrist.y < rightShoulder.y);
}

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
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

document.addEventListener('DOMContentLoaded', init);

