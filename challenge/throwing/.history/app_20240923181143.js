const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const footInfo = document.getElementById("footInfo");
const armInfo = document.getElementById("armInfo");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 5000; // 5 seconds
let countdownTimer = 5;
let isDetectionStarted = false;
let armScore = 10;
let trunkStabilityScore = 10;
let maxDisplacement = 0;
let initialPose = null;
let throwingPhase = "preparation";
let throwingScores = {
  preparation: 0,
  propulsion: 0,
  release: 0,
  followThrough: 0,
};
let isThrowingStarted = false;
let startingPositionHoldTime = 0;
const STARTING_POSITION_HOLD_DURATION = 3000; // 3 seconds

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
  info.innerHTML += "<br>Please stand where your full body is visible";

  if (countdownTimer > 0) {
    countdownTimer--;
    setTimeout(startCountdown, 1000);
  } else {
    isDetectionStarted = true;
    info.textContent = "Start throwing!";
    throwingPhase = "preparation";
  }
}

function calculateAngle(a, b, c) {
  let radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function checkArmRaised(shoulder, elbow, wrist) {
  const heightScore = getArmHeightScore(shoulder, wrist);
  const extensionScore = getArmExtensionScore(shoulder, elbow, wrist);
  const score = (heightScore + extensionScore) / 2;
  return { status: score > 0 ? "raised" : "lowered", score: score };
}

function getArmHeightScore(shoulder, wrist) {
  const heightDiff = shoulder.y - wrist.y;
  if (heightDiff >= 0) return 10;
  if (heightDiff > -0.1) return 8;
  if (heightDiff > -0.2) return 6;
  return 4;
}

function getArmExtensionScore(shoulder, elbow, wrist) {
  const angle = calculateAngle(shoulder, elbow, wrist);
  if (angle >= 170) return 10;
  if (angle >= 150) return 8;
  if (angle >= 120) return 6;
  return 4;
}

function calculateTrunkStability() {
  console.log(
    "Calculating trunk stability, max displacement:",
    maxDisplacement
  );
  if (maxDisplacement < 0.01) return 10;
  if (maxDisplacement < 0.02) return 9;
  if (maxDisplacement < 0.03) return 8;
  if (maxDisplacement < 0.04) return 7;
  if (maxDisplacement < 0.05) return 6;
  if (maxDisplacement < 0.06) return 5;
  if (maxDisplacement < 0.08) return 4;
  if (maxDisplacement < 0.1) return 3;
  if (maxDisplacement < 0.15) return 2;
  if (maxDisplacement < 0.2) return 1;
  return 0;
}

function updateMaxDisplacement(landmarks) {
  if (!initialPose) return;

  const calculateDisplacement = (initial, current) => {
    const dx = initial.x - current.x;
    const dy = initial.y - current.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const displacements = [
    calculateDisplacement(initialPose.nose, landmarks[0]),
    calculateDisplacement(initialPose.leftShoulder, landmarks[11]),
    calculateDisplacement(initialPose.rightShoulder, landmarks[12]),
    calculateDisplacement(initialPose.leftHip, landmarks[23]),
    calculateDisplacement(initialPose.rightHip, landmarks[24]),
  ];

  const currentMaxDisplacement = Math.max(...displacements);
  maxDisplacement = Math.max(maxDisplacement, currentMaxDisplacement);
  console.log("Current max displacement:", maxDisplacement);
}

function checkThrowingPose(landmarks) {
  if (!isThrowingStarted) {
    if (checkStartingPosition(landmarks)) {
      const currentTime = Date.now();
      if (startingPositionHoldTime === 0) {
        startingPositionHoldTime = currentTime;
      } else if (
        currentTime - startingPositionHoldTime >=
        STARTING_POSITION_HOLD_DURATION
      ) {
        isThrowingStarted = true;
        info.textContent = "Starting position held. Begin throwing!";
      }
    } else {
      startingPositionHoldTime = 0;
    }
    return;
  }

  const footStepScore = checkFootStep(landmarks);
  const armSpeedScore = checkArmSpeed(landmarks);

  const totalScore = footStepScore + armSpeedScore;

  if (isThrowingCompleted(landmarks)) {
    showResultPage(totalScore, { footStepScore, armSpeedScore });
    isDetectionStarted = false;
  }
}

function checkStartingPosition(landmarks) {
  const isSideOn = checkSideOnStance(landmarks);
  const isArmBehindHead = checkArmBehindHead(landmarks);
  const isOneFootForward = checkOneFootForward(landmarks);

  updateStartingPositionFeedback(isSideOn, isArmBehindHead, isOneFootForward);

  return isSideOn && isArmBehindHead && isOneFootForward;
}

function updateStartingPositionFeedback(
  isSideOn,
  isArmBehindHead,
  isOneFootForward
) {
  if (!isSideOn) {
    info.textContent = "Please turn sideways to the camera";
  } else if (!isArmBehindHead) {
    info.textContent = "Please place one hand behind your head";
  } else if (!isOneFootForward) {
    info.textContent = "Please step forward with one foot";
  } else {
    info.textContent = "Great! Hold this position for 3 seconds";
  }
}

function isThrowingCompleted(landmarks) {
  const nose = landmarks[0];
  const wrist = landmarks[16]; // 右手腕
  return wrist.x > nose.x;
}

function checkFootStep(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const stepDiff = Math.abs(leftAnkle.x - rightAnkle.x);
  if (stepDiff > 0.2) return 50; // 明显迈步
  if (stepDiff > 0.1) return 30; // 轻微迈步
  return 10; // 未迈步
}

let previousWristPosition = null;
let previousTimestamp = null;

function checkArmSpeed(landmarks) {
  const wrist = landmarks[16]; // 右手腕
  const currentTimestamp = Date.now();

  if (previousWristPosition && previousTimestamp) {
    const distance = Math.sqrt(
      Math.pow(wrist.x - previousWristPosition.x, 2) +
        Math.pow(wrist.y - previousWristPosition.y, 2)
    );
    const timeDiff = (currentTimestamp - previousTimestamp) / 1000; // 转换为秒
    const speed = distance / timeDiff;

    previousWristPosition = wrist;
    previousTimestamp = currentTimestamp;

    if (speed > 2) return 50; // 快速
    if (speed > 1) return 30; // 中速
    return 10; // 慢速
  }

  previousWristPosition = wrist;
  previousTimestamp = currentTimestamp;
  return 0;
}

function getArmFeedback(score) {
  if (score >= 9) return "Excellent arm position!";
  if (score >= 7)
    return "Good arm position. Try to raise your arm a bit higher and extend it more.";
  if (score >= 5)
    return "Moderate arm position. Focus on raising your arm to shoulder level and extending it fully.";
  return "Keep working on raising your arm higher and extending it more.";
}

function getTrunkFeedback(score) {
  if (score === 10) return "Perfect stability! You remained incredibly steady.";
  if (score >= 8) return "Excellent stability. Very minimal movement detected.";
  if (score >= 6)
    return "Good stability. Some slight movement, but overall well maintained.";
  if (score >= 4)
    return "Fair stability. Try to reduce your body's movement more.";
  if (score >= 2)
    return "Needs improvement. Focus on keeping your body as still as possible.";
  return "Significant movement detected. Practice holding your position steady.";
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
    scores.footStepScore.toFixed(1);
  document.getElementById("armSpeedScore").textContent =
    scores.armSpeedScore.toFixed(1);
  document.getElementById("throwingFeedback").textContent =
    getThrowingFeedback(totalScore);

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

function getThrowingFeedback(score) {
  if (score >= 90) return "Excellent throwing form!";
  if (score >= 75) return "Very good throw, with some room for improvement.";
  if (score >= 60) return "Good attempt, keep practicing to improve your form.";
  if (score >= 40)
    return "Fair throw, focus on improving your technique in each phase.";
  return "Keep practicing! Pay attention to the proper form in each phase of the throw.";
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

    checkThrowingPose(results.poseLandmarks);
    updateInfoDisplay();
  }

  canvasCtx.restore();
}

window.addEventListener("load", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

window.addEventListener("resize", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

function checkSideOnStance(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const shoulderDiff = Math.abs(leftShoulder.z - rightShoulder.z);
  const hipDiff = Math.abs(leftHip.z - rightHip.z);

  const isSideOn = shoulderDiff > 0.1 && hipDiff > 0.1;
  return isSideOn ? 1 : 0;
}

function checkArmBehindHead(landmarks) {
  const nose = landmarks[0];
  const wrist = landmarks[16]; // 右手腕
  return wrist.x < nose.x ? 1 : 0;
}

function checkOneFootForward(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const ankleDiff = Math.abs(leftAnkle.z - rightAnkle.z);
  return ankleDiff > 0.1;
}

function updateInfoDisplay() {
  info.textContent = `Current phase: ${throwingPhase}`;
}
