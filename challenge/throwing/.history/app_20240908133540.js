const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const footInfo = document.getElementById("footInfo");
const armInfo = document.getElementById("armInfo");
const headInfo = document.getElementById("headInfo");
const trunkInfo = document.getElementById("trunkInfo");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

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
    info.textContent = "Strike a balance pose";
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

function checkArmRaised(shoulder, wrist) {
  const heightDiff = shoulder.y - wrist.y;

  // Arms are considered "raised" if the wrist is above the shoulder
  if (heightDiff > 0.05) {
    return "raised";
  }
  return "lowered";
}

function checkBalancePose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const nose = landmarks[0];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.05;
  const leftArmStatus = checkArmRaised(leftShoulder, leftWrist);
  const rightArmStatus = checkArmRaised(rightShoulder, rightWrist);
  const headForward = checkHeadForward(nose, leftShoulder, rightShoulder);
  const trunkStable = checkTrunkStability(
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip
  );

  updateStabilityScores(leftWrist, rightWrist);

  const currentTime = Date.now();

  if (
    oneFootRaised &&
    leftArmStatus === "raised" &&
    rightArmStatus === "raised" &&
    headForward &&
    trunkStable
  ) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      footInfo.textContent = "Great! Keep your foot raised.";
      armInfo.textContent = "Arms are raised!";
      headInfo.textContent = "Good head position!";
      trunkInfo.textContent = "Trunk stable!";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      const totalScore = (armStabilityScore + trunkStabilityScore) / 2;
      const resultData = {
        armScore: armStabilityScore,
        trunkScore: trunkStabilityScore,
        totalScore: totalScore,
        armFeedback: getArmFeedback(
          armStabilityScore,
          leftWrist,
          rightWrist,
          leftShoulder,
          rightShoulder
        ),
        trunkFeedback: getTrunkFeedback(trunkStabilityScore),
      };
      showResultPage(resultData);
    } else {
      const remainingTime = Math.ceil(
        (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
      );
      info.textContent = `Hold steady for ${remainingTime} more seconds!`;
    }
  } else {
    balancePoseDetected = false;
    resetPoseDetection(
      oneFootRaised,
      leftArmStatus,
      rightArmStatus,
      headForward,
      trunkStable
    );
  }
}

function checkHeadForward(nose, leftShoulder, rightShoulder) {
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const headForward = Math.abs(nose.x - shoulderMidpoint.x) < 0.1;
  headInfo.textContent = headForward
    ? "Head position good"
    : "Look straight ahead";
  return headForward;
}

function checkTrunkStability(leftShoulder, rightShoulder, leftHip, rightHip) {
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMidpoint = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };
  const trunkStable = Math.abs(shoulderMidpoint.x - hipMidpoint.x) < 0.03; // Stricter threshold

  trunkInfo.textContent = trunkStable
    ? "Trunk stable"
    : "Keep your trunk steady";
  trunkStabilityScore = trunkStable
    ? trunkStabilityScore
    : trunkStabilityScore - 1; // Decrease score if unstable

  return trunkStable;
}

function updateStabilityScores(leftWrist, rightWrist) {
  if (prevWristPositions.left && prevWristPositions.right) {
    const leftMovement = calculateDistance(leftWrist, prevWristPositions.left);
    const rightMovement = calculateDistance(
      rightWrist,
      prevWristPositions.right
    );
    const totalMovement = leftMovement + rightMovement;

    // Stricter scoring: reduce more points for small movements
    armStabilityScore = Math.max(0, 10 - totalMovement * 150); // Increase sensitivity by raising multiplier
  }

  prevWristPositions = { left: leftWrist, right: rightWrist };
}

function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
  );
}

function resetPoseDetection(
  oneFootRaised,
  armsTPosition,
  headForward,
  trunkStable
) {
  footInfo.textContent = oneFootRaised ? "" : "Raise one foot higher.";
  armInfo.textContent = armsTPosition ? "" : "Extend your arms.";
  headInfo.textContent = headForward ? "" : "Look straight ahead.";
}

function getArmFeedback(score, leftWrist, rightWrist, leftShoulder, rightShoulder) {
  const leftArmExtended = Math.abs(leftWrist.y - leftShoulder.y) < 0.1;
  const rightArmExtended = Math.abs(rightWrist.y - rightShoulder.y) < 0.1;
  
  if (score >= 9 && leftArmExtended && rightArmExtended) return "Excellent arm stability and extension!";
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
  // Hide real-time floating information
  footInfo.style.display = "none";
  armInfo.style.display = "none";
  headInfo.style.display = "none";
  trunkInfo.style.display = "none";
  info.style.display = "none"; // Hide the countdown info

  // Hide video and canvas
  video.style.display = "none";
  canvasElement.style.display = "none";

  // Show result page
  const resultPage = document.getElementById("resultPage");
  resultPage.style.display = "block";

  // Update result page content
  document.getElementById("totalScore").textContent =
    resultData.totalScore.toFixed(1);
  document.getElementById("armScore").textContent =
    resultData.armScore.toFixed(1);
  document.getElementById("trunkScore").textContent =
    resultData.trunkScore.toFixed(1);
  document.getElementById("armFeedback").textContent = resultData.armFeedback;
  document.getElementById("trunkFeedback").textContent =
    resultData.trunkFeedback;

  // Remove any previous event listeners before adding new ones
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
    info.style.display = "block"; // Reset for a new session
    info.textContent = 'Click "Start" to begin';
  });
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
