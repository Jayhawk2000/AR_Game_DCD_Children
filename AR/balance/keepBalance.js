let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let balanceStartTime = 0;
const BALANCE_DURATION = 5000; // 10 seconds

function initializeElements() {
  video = document.getElementById("video3");
  canvas = document.createElement("canvas");
  canvas.width = video.width;
  canvas.height = video.height;
  ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);
}

function initializeCamera() {
  camera = new Camera(video, {
    onFrame: async () => {
      if (pose && isDetectionStarted) {
        await pose.send({ image: video });
      }
    },
    width: 1280,
    height: 720,
  });
}

function initializePose() {
  pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    },
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  pose.onResults(onResults);
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 4,
    });
    drawLandmarks(ctx, results.poseLandmarks, {
      color: "#FF0000",
      lineWidth: 2,
    });

    checkKeepBalance(results.poseLandmarks);
  }

  ctx.restore();
}

function checkKeepBalance(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  const footDifference = Math.abs(leftAnkle.y - rightAnkle.y);
  const oneFootLifted = footDifference > 0.1;
  const armsRaised =
    leftShoulder.y > landmarks[13].y && rightShoulder.y > landmarks[14].y;

  const instructionText = document.getElementById("instruction-text");

  if (oneFootLifted && armsRaised) {
    if (balanceStartTime === 0) {
      balanceStartTime = Date.now();
    }

    const elapsedTime = Date.now() - balanceStartTime;
    const remainingTime = Math.max(
      0,
      Math.ceil((BALANCE_DURATION - elapsedTime) / 1000)
    );

    if (elapsedTime < BALANCE_DURATION) {
      instructionText.textContent = `Great! Keep your balance for ${remainingTime} more seconds.`;
    } else {
      instructionText.textContent =
        "Excellent! You've maintained balance for 10 seconds.";
    }
  } else {
    balanceStartTime = 0;
    if (!oneFootLifted) {
      instructionText.textContent = "Lift one foot off the ground.";
    } else if (!armsRaised) {
      instructionText.textContent = "Raise both arms above your shoulders.";
    }
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

document.addEventListener("DOMContentLoaded", init);
