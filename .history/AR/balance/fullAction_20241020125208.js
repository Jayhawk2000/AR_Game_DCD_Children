let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let balancePoseDetected = false;
let currentStep = 0;
const TOTAL_STEPS = 4;

function initializeElements() {
  video = document.getElementById('video4');
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
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
    
    checkFullAction(results.poseLandmarks);
  }

  ctx.restore();
}

function checkFullAction(landmarks) {
  const instructionText = document.getElementById('instruction-text');
  
  switch(currentStep) {
    case 0:
      if (checkRaiseArms(landmarks)) {
        currentStep++;
        instructionText.textContent = "Great! Now look ahead, eyes on something in front of you.";
      } else {
        instructionText.textContent = "Raise your arms slowly like airplane wings.";
      }
      break;
    case 1:
      if (checkLookAhead(landmarks)) {
        currentStep++;
        instructionText.textContent = "Perfect! Now lift one of your feet up, nice and slow.";
      } else {
        instructionText.textContent = "Keep looking ahead, eyes on something in front of you.";
      }
      break;
    case 2:
      if (checkLiftFoot(landmarks)) {
        currentStep++;
        instructionText.textContent = "Excellent! Now keep your balance for 5 seconds.";
      } else {
        instructionText.textContent = "Lift one of your feet up, nice and slow.";
      }
      break;
    case 3:
      if (checkKeepBalance(landmarks)) {
        instructionText.textContent = "Great job! You've completed the full balance action!";
      } else {
        instructionText.textContent = "Keep your balance, you're doing great!";
      }
      break;
  }
}

function checkRaiseArms(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  return (leftWrist.y < leftShoulder.y) && (rightWrist.y < rightShoulder.y);
}

function checkLookAhead(landmarks) {
  // This is a simplified check. In reality, you might need more sophisticated logic.
  const nose = landmarks[0];
  const leftEye = landmarks[2];
  const rightEye = landmarks[5];

  return Math.abs(nose.z - leftEye.z) < 0.1 && Math.abs(nose.z - rightEye.z) < 0.1;
}

function checkLiftFoot(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  return Math.abs(leftAnkle.y - rightAnkle.y) > 0.1;
}

function checkKeepBalance(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  const footDifference = Math.abs(leftAnkle.y - rightAnkle.y);
  const oneFootLifted = footDifference > 0.1;
  const armsRaised = (leftShoulder.y > landmarks[13].y) && (rightShoulder.y > landmarks[14].y);

  return oneFootLifted && armsRaised;
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

