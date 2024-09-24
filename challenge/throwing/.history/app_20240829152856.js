const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 3000; // 3 seconds in milliseconds
let countdownTimer = 5; // 5 seconds countdown
let isCountingDown = false;
let isUserInPosition = false;

startButton.addEventListener("click", initCamera);

function initCamera() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

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

  camera = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video });
    },
    width: 1280,
    height: 720,
  });

  camera
    .start()
    .then(() => {
      info.textContent = "Camera activated. Get ready!";
      startCountdown();
    })
    .catch((error) => {
      console.error(error);
      info.textContent = "Camera error";
    });
}

function startCountdown() {
  isCountingDown = true;
  updateCountdown();
}

function updateCountdown() {
  if (countdownTimer > 0) {
    info.textContent = `Get ready! ${countdownTimer}`;
    countdownTimer--;
    setTimeout(updateCountdown, 1000);
  } else {
    info.textContent = "Step into the highlighted area";
    isCountingDown = false;
  }
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  // Draw semi-transparent overlay outside the detection area
  canvasCtx.fillStyle = "rgba(128, 128, 128, 0.5)";
  canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  // Clear the detection area
  canvasCtx.clearRect(
    canvasElement.width * 0.15,
    canvasElement.height * 0.15,
    canvasElement.width * 0.7,
    canvasElement.height * 0.7
  );

  // Draw detection area border
  canvasCtx.strokeStyle = "rgba(0, 255, 0, 0.8)";
  canvasCtx.lineWidth = 4;
  canvasCtx.strokeRect(
    canvasElement.width * 0.15,
    canvasElement.height * 0.15,
    canvasElement.width * 0.7,
    canvasElement.height * 0.7
  );

  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "rgba(0, 255, 255, 0.5)",
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "rgba(255, 0, 255, 0.5)",
      lineWidth: 2,
    });

    if (!isCountingDown) {
      checkUserInPosition(results.poseLandmarks);
      if (isUserInPosition) {
        checkBalancePose(results.poseLandmarks);
      }
    }
  }

  canvasCtx.restore();
}

function checkUserInPosition(landmarks) {
  const allLandmarksInFrame = landmarks.every(
    (landmark) =>
      landmark.x >= 0.15 &&
      landmark.x <= 0.85 &&
      landmark.y >= 0.15 &&
      landmark.y <= 0.85
  );

  if (allLandmarksInFrame && !isUserInPosition) {
    isUserInPosition = true;
    info.textContent = "Strike a balance pose";
  } else if (!allLandmarksInFrame && isUserInPosition) {
    isUserInPosition = false;
    info.textContent = "Step into the highlighted area";
  }
}

function checkBalancePose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y) < 0.1;
  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.05;
  const armsRaised =
    leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;

  const currentTime = new Date().getTime();

  if (shoulderLevel && oneFootRaised && armsRaised) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      info.textContent = "Hold pose";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      info.textContent = "Great balance!";
      setTimeout(() => {
        info.textContent = "Try again";
        balancePoseDetected = false;
      }, 2000);
    } else {
      const remainingTime = Math.ceil(
        (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
      );
      info.textContent = `${remainingTime}`;
    }
  } else {
    if (balancePoseDetected) {
      info.textContent = "Try again";
      balancePoseDetected = false;
    } else {
      info.textContent = "Strike a balance pose";
    }
  }
}

window.addEventListener("load", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

window.addEventListener("resize", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});
