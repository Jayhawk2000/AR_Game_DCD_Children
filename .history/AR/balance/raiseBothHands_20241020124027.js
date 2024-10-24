let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;

function initializeElements() {
  video = document.getElementById('video1');
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
    
    checkRaiseBothHands(results.poseLandmarks);
  }

  ctx.restore();
}

function checkRaiseBothHands(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const leftArmRaised = leftWrist.y < leftShoulder.y;
  const rightArmRaised = rightWrist.y < rightShoulder.y;

  const instructionText = document.getElementById('instruction-text');
  if (leftArmRaised && rightArmRaised) {
    instructionText.textContent = "Great! Both hands are raised.";
  } else if (leftArmRaised) {
    instructionText.textContent = "Raise your right hand higher.";
  } else if (rightArmRaised) {
    instructionText.textContent = "Raise your left hand higher.";
  } else {
    instructionText.textContent = "Raise both hands above your shoulders.";
  }
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
