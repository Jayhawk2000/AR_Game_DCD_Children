const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const poseInfo = document.getElementById("poseInfo");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");
const mainContent = document.getElementById("mainContent");
const resultPage = document.getElementById("resultPage");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 5000; // 5 seconds
let countdownTimer = 5;
let isDetectionStarted = false;
let prevWristPositions = { left: null, right: null };
let armStabilityScore = 10;
let trunkStabilityScore = 10;

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
        await pose.send({ image: video });
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
  poseInfo.textContent = "Please stand where your full body is visible";

  if (countdownTimer > 0) {
    countdownTimer--;
    setTimeout(startCountdown, 1000);
  } else {
    info.textContent = "Strike a balance pose";
    poseInfo.textContent = "Raise one foot, extend arms, and look forward";
    isDetectionStarted = true;
    console.log("Detection started"); // 添加日志
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

function checkBalancePose(landmarks) {
  if (!isDetectionStarted) return; // 如果检测还没开始，直接返回

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const nose = landmarks[0];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.05;
  const armsRaised = checkArmsRaised(
    leftShoulder,
    leftElbow,
    leftWrist,
    rightShoulder,
    rightElbow,
    rightWrist
  );
  const headForward = checkHeadForward(nose, leftShoulder, rightShoulder);

  updateStabilityScores(
    leftWrist,
    rightWrist,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip
  );

  console.log("Pose check:", { oneFootRaised, armsRaised, headForward }); // 添加日志

  if (oneFootRaised && armsRaised && headForward) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = Date.now();
      poseInfo.textContent = "Great! Hold this pose for 5 seconds.";
    } else {
      const currentTime = Date.now();
      if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
        const totalScore = (armStabilityScore + trunkStabilityScore) / 2;
        const resultData = {
          armScore: armStabilityScore,
          trunkScore: trunkStabilityScore,
          totalScore: totalScore,
          armFeedback: getArmFeedback(armStabilityScore),
          trunkFeedback: getTrunkFeedback(trunkStabilityScore),
        };
        showResultPage(resultData);
      } else {
        const remainingTime = Math.ceil(
          (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
        );
        poseInfo.textContent = `Hold steady for ${remainingTime} more seconds!`;
      }
    }
  } else {
    balancePoseDetected = false;
    updatePoseInfo(oneFootRaised, armsRaised, headForward);
  }
}

function checkArmsRaised(
  leftShoulder,
  leftElbow,
  leftWrist,
  rightShoulder,
  rightElbow,
  rightWrist
) {
  const leftArmRaised = checkArmRaised(leftShoulder, leftElbow, leftWrist);
  const rightArmRaised = checkArmRaised(rightShoulder, rightElbow, rightWrist);
  return leftArmRaised && rightArmRaised;
}

function checkArmRaised(shoulder, elbow, wrist) {
  const angle = calculateAngle(shoulder, elbow, wrist);
  const heightDiff = shoulder.y - wrist.y;
  return angle >= 150 && heightDiff > 0.05;
}

function checkHeadForward(nose, leftShoulder, rightShoulder) {
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  return Math.abs(nose.x - shoulderMidpoint.x) < 0.1;
}

function updateStabilityScores(
  leftWrist,
  rightWrist,
  leftShoulder,
  rightShoulder,
  leftHip,
  rightHip
) {
  // Update arm stability score
  if (prevWristPositions.left && prevWristPositions.right) {
    const leftMovement = calculateDistance(leftWrist, prevWristPositions.left);
    const rightMovement = calculateDistance(
      rightWrist,
      prevWristPositions.right
    );
    const totalMovement = leftMovement + rightMovement;
    armStabilityScore = Math.max(0, 10 - totalMovement * 100);
  }
  prevWristPositions = { left: leftWrist, right: rightWrist };

  // Update trunk stability score
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMidpoint = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };
  const trunkMovement = calculateDistance(shoulderMidpoint, hipMidpoint);
  trunkStabilityScore = Math.max(0, 10 - trunkMovement * 200);
}

function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
  );
}

function updatePoseInfo(oneFootRaised, armsRaised, headForward) {
  let message = "";
  if (!oneFootRaised) message += "Raise one foot. ";
  if (!armsRaised) message += "Raise both arms to shoulder height. ";
  if (!headForward) message += "Look straight ahead. ";
  poseInfo.textContent = message || "Get ready to hold the pose!";
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

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

    checkBalancePose(results.poseLandmarks);
  }

  canvasCtx.restore();
}

function getArmFeedback(score) {
  if (score >= 9) return "Excellent arm stability!";
  if (score >= 7) return "Good arm stability, minor movements detected.";
  if (score >= 5) return "Moderate arm stability, try to minimize movements.";
  return "Significant arm movements detected, focus on keeping arms steady.";
}

function getTrunkFeedback(score) {
  if (score >= 9) return "Excellent trunk stability!";
  if (score >= 7) return "Good trunk stability, minor movements detected.";
  if (score >= 5) return "Moderate trunk stability, try to minimize movements.";
  return "Significant trunk movements detected, focus on keeping your body steady.";
}

function showResultPage(resultData) {
  mainContent.style.display = "none";
  resultPage.style.display = "block";

  document.getElementById("totalScore").textContent =
    resultData.totalScore.toFixed(1);
  document.getElementById("armScore").textContent =
    resultData.armScore.toFixed(1);
  document.getElementById("trunkScore").textContent =
    resultData.trunkScore.toFixed(1);
  document.getElementById("armFeedback").textContent = resultData.armFeedback;
  document.getElementById("trunkFeedback").textContent =
    resultData.trunkFeedback;

  document.getElementById("retryButton").addEventListener("click", () => {
    resultPage.style.display = "none";
    mainContent.style.display = "block";
    resetAndStartProcess();
  });

  document.getElementById("returnButton").addEventListener("click", () => {
    resultPage.style.display = "none";
    mainContent.style.display = "block";
    resetToInitialState();
  });
}

function resetAndStartProcess() {
  resetState();
  startProcess();
}

function resetToInitialState() {
  resetState();
  startButton.style.display = "block";
  info.textContent = 'Click "Start" to begin';
  poseInfo.textContent = "";
}

function resetState() {
  balancePoseDetected = false;
  balancePoseStartTime = 0;
  countdownTimer = 5;
  isDetectionStarted = false;
  prevWristPositions = { left: null, right: null };
  armStabilityScore = 10;
  trunkStabilityScore = 10;
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

    checkBalancePose(results.poseLandmarks);
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
