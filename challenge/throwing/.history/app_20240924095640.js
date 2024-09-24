const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const footInfo = document.getElementById("footInfo");
const armInfo = document.getElementById("armInfo");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let isDetectionStarted = false;
let jumpPhase = "preparation";
let isJumpingStarted = false;
let jumpStartTime = 0;
const JUMP_PREPARE_DURATION = 3000; // 3 seconds for feet apart and knees bent
const MIN_JUMP_HEIGHT = 0.2; // Minimum jump height to score points
let countdownTimer = 5; // 5-second countdown before starting detection

startButton.addEventListener("click", startProcess);

function startProcess() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

  initCamera()
    .then(() => {
      startCountdown();
    })
    .catch((error) => {
      console.error("Initialization failed:", error);
      info.textContent = "Failed to initialize camera or pose detection.";
    });
}

function initCamera() {
  return new Promise((resolve, reject) => {
    camera = new Camera(video, {
      onFrame: async () => {
        if (pose && isDetectionStarted) {
          await pose.send({ image: video });
        }
      },
      width: 1280,
      height: 720,
    });

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

    camera
      .start()
      .then(() => {
        console.log("Camera started successfully");
        video.style.display = "block";
        canvasElement.style.display = "block";
        resolve();
      })
      .catch((error) => {
        console.error("Error starting camera:", error);
        info.textContent = "Error starting camera: " + error.message;
        reject(error);
      });
  });
}

function startCountdown() {
  info.textContent = `Get ready! ${countdownTimer}`;
  info.innerHTML += "<br>Please stand where your full body is visible.";

  if (countdownTimer > 0) {
    countdownTimer--;
    setTimeout(startCountdown, 1000);
  } else {
    isDetectionStarted = true;
    info.textContent = "Prepare to jump: feet apart and knees bent!";
    jumpPhase = "preparation";
  }
}

// Function to detect if feet are apart and knees are bent
function checkJumpPreparation(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  // Check if feet are apart
  const feetApart = Math.abs(leftAnkle.x - rightAnkle.x) > 0.1;

  // Check if knees are bent (angle between hip, knee, and ankle should be < 160 degrees)
  const leftKneeBent = calculateAngle(leftHip, leftKnee, leftAnkle) < 160;
  const rightKneeBent = calculateAngle(rightHip, rightKnee, rightAnkle) < 160;

  return feetApart && leftKneeBent;
}

function checkJumpingPose(landmarks) {
  if (!isJumpingStarted) {
    if (checkJumpPreparation(landmarks)) {
      const currentTime = Date.now();
      if (jumpStartTime === 0) {
        jumpStartTime = currentTime;
      } else if (currentTime - jumpStartTime >= JUMP_PREPARE_DURATION) {
        isJumpingStarted = true;
        info.textContent = "Ready! Jump now!";
      }
    } else {
      jumpStartTime = 0;
      info.textContent = "Make sure your feet are apart and knees bent.";
    }
    return;
  }

  // Detect jump and landing
  const jumpHeight = detectJumpHeight(landmarks);
  const landedFeetApart = checkFeetApartOnLanding(landmarks);

  const jumpScore = jumpHeight > MIN_JUMP_HEIGHT ? 50 : 0;
  const landingScore = landedFeetApart ? 50 : 0;

  const totalScore = jumpScore + landingScore;
  showResultPage(totalScore, { jumpScore, landingScore });
  isDetectionStarted = false;
}

function detectJumpHeight(landmarks) {
  const initialY = initialPose ? initialPose.leftAnkle.y : 0;
  const currentY = landmarks[27].y; // Left ankle Y-coordinate
  return initialY - currentY; // The jump height
}

function checkFeetApartOnLanding(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  return Math.abs(leftAnkle.x - rightAnkle.x) > 0.1; // Check if feet are apart on landing
}

function calculateAngle(a, b, c) {
  let radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.x, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
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

  if (results.poseLandmarks && isDetectionStarted) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "rgba(0, 255, 255, 0.3)",
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "rgba(255, 0, 255, 0.3)",
      lineWidth: 2,
      radius: 6,
    });

    checkJumpingPose(results.poseLandmarks); 
    updateInfoDisplay();
  }

  canvasCtx.restore();
}

function updateInfoDisplay() {
  info.textContent = `Current phase: ${jumpPhase}`;
}

function showResultPage(totalScore, scores) {
  footInfo.style.display = "none";
  armInfo.style.display = "none";
  info.style.display = "none";
  video.style.display = "none";
  canvasElement.style.display = "none";

  const resultPage = document.getElementById("resultPage");
  resultPage.style.display = "block";

  document.getElementById("totalScore").textContent = totalScore.toFixed(1);
  document.getElementById("footStepScore").textContent =
    scores.jumpScore.toFixed(1);
  document.getElementById("armSpeedScore").textContent =
    scores.landingScore.toFixed(1);
  document.getElementById("throwingFeedback").textContent =
    getJumpingFeedback(totalScore);

  const retryButton = document.getElementById("retryButton");
  const returnButton = document.getElementById("returnButton");

  retryButton.replaceWith(retryButton.cloneNode(true));
  returnButton.replaceWith(returnButton.cloneNode(true));

  document.getElementById("retryButton").addEventListener("click", () => {
    resultPage.style.display = "none";
    startProcess();
  });

  document.getElementById("returnButton").addEventListener("click", () => {
    resultPage.style.display = "none";
    startButton.style.display = "block";
    info.style.display = "block";
    info.textContent = 'Click "Start" to begin';
  });
}

function getJumpingFeedback(score) {
  if (score >= 90) return "Excellent jump!";
  if (score >= 75) return "Very good jump, with some room for improvement.";
  if (score >= 60) return "Good attempt, keep practicing to improve your form.";
  if (score >= 40) return "Fair jump, focus on improving your technique.";
  return "Keep practicing! Focus on the proper jumping technique.";
}
