let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let fullActionDetected = false;
let currentStep = 0;
const TOTAL_STEPS = 7; // 根据跳远动作的步骤数调整

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
    
    checkFullAction(results.poseLandmarks);
  }

  ctx.restore();
}

function checkFullAction(landmarks) {
  const instructionText = document.getElementById('instruction-text');
  
  switch(currentStep) {
    case 0:
      if (checkArmSwing(landmarks)) {
        currentStep++;
        instructionText.textContent = "Great! Now coil the spring, getting ready to jump big!";
      }
      break;
    case 1:
      if (checkCoilSpring(landmarks)) {
        currentStep++;
        instructionText.textContent = "Perfect! Now head up, eyes forward!";
      }
      break;
    case 2:
      if (checkHeadUp(landmarks)) {
        currentStep++;
        instructionText.textContent = "Excellent! Now straighten your legs and stretch your arms!";
      }
      break;
    case 3:
      if (checkStraightenLegs(landmarks)) {
        currentStep++;
        instructionText.textContent = "Amazing! Now jump up and try to reach for the sky!";
      }
      break;
    case 4:
      if (checkJumpUp(landmarks)) {
        currentStep++;
        instructionText.textContent = "Fantastic! Now land softly!";
      }
      break;
    case 5:
      if (checkLandSoftly(landmarks)) {
        currentStep++;
        instructionText.textContent = "Great landing! Now be as quiet as a little mouse!";
      }
      break;
    case 6:
      if (checkQuietStance(landmarks)) {
        fullActionDetected = true;
        instructionText.textContent = "Congratulations! You've completed the full jump action!";
      }
      break;
  }
}

// 以下函数需要根据具体的姿势检测逻辑来实现
function checkArmSwing(landmarks) {
  // 实现手臂摆动检测逻辑
}

function checkCoilSpring(landmarks) {
  // 实现蓄力姿势检测逻辑
}

function checkHeadUp(landmarks) {
  // 实现抬头挺胸检测逻辑
}

function checkStraightenLegs(landmarks) {
  // 实现伸直腿部检测逻辑
}

function checkJumpUp(landmarks) {
  // 实现跳跃检测逻辑
}

function checkLandSoftly(landmarks) {
  // 实现软着陆检测逻辑
}

function checkQuietStance(landmarks) {
  // 实现静止姿势检测逻辑
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

