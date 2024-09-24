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
let initialPosePosition = null;
let isMeasuringStability = false;

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

function checkArmRaised(shoulder, elbow, wrist) {
  const heightScore = getArmHeightScore(shoulder, wrist);
  const extensionScore = getArmExtensionScore(shoulder, elbow, wrist);
  const score = (heightScore + extensionScore) / 2;
  return { status: score > 0 ? "raised" : "lowered", score: score };
}

function getArmHeightScore(shoulder, wrist) {
  const heightDiff = shoulder.y - wrist.y;
  if (heightDiff >= 0) {
    return 10; // Hand at or above shoulder level
  } else if (heightDiff > -0.1) {
    return 8; // Hand slightly below shoulder
  } else if (heightDiff > -0.2) {
    return 6; // Hand moderately below shoulder
  } else {
    return 4; // Hand far below shoulder
  }
}

function getArmExtensionScore(shoulder, elbow, wrist) {
  const angle = calculateAngle(shoulder, elbow, wrist);
  if (angle >= 170) {
    return 10; // Arm almost fully extended
  } else if (angle >= 150) {
    return 8; // Arm well extended
  } else if (angle >= 120) {
    return 6; // Arm moderately extended
  } else {
    return 4; // Arm not well extended
  }
}

function checkBalancePose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const nose = landmarks[0];

  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.05;
  const leftArmStatus = checkArmRaised(leftShoulder, leftElbow, leftWrist);
  const rightArmStatus = checkArmRaised(rightShoulder, rightElbow, rightWrist);

  updateTrunkStabilityScore(
    nose,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip
  );

  const currentTime = Date.now();

  if (
    oneFootRaised &&
    (leftArmStatus.status === "raised" || rightArmStatus.status === "raised")
  ) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      initialPosePosition = {
        nose: { ...landmarks[0] },
        leftShoulder: { ...landmarks[11] },
        rightShoulder: { ...landmarks[12] },
        leftHip: { ...landmarks[23] },
        rightHip: { ...landmarks[24] },
      };
      isMeasuringStability = true;
      footInfo.textContent = "Great! Keep your foot raised.";
      armInfo.textContent = "Arm raised, maintain position!";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      armScore = Math.max(leftArmStatus.score, rightArmStatus.score);
      trunkStabilityScore = calculateTrunkStability(landmarks);
      isMeasuringStability = false;
      const totalScore = (armScore + trunkStabilityScore) / 2;
      const resultData = {
        armScore: armScore,
        trunkScore: trunkStabilityScore,
        totalScore: totalScore,
        armFeedback: getArmFeedback(armScore),
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
    isMeasuringStability = false;
    resetPoseDetection(
      oneFootRaised,
      leftArmStatus.status === "raised" || rightArmStatus.status === "raised"
    );
  }
}

function updateTrunkStabilityScore(
  nose,
  leftShoulder,
  rightShoulder,
  leftHip,
  rightHip
) {
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMidpoint = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };

  const trunkMovement = calculateDistance(shoulderMidpoint, hipMidpoint);
  const headMovement = calculateDistance(nose, shoulderMidpoint);

  // Combine trunk and head movement for overall stability score
  const totalMovement = trunkMovement + headMovement;

  // Update score based on movement (less movement = higher score)
  trunkStabilityScore = Math.max(0, 10 - totalMovement * 100);

  // Ensure score doesn't drop below 5 too easily
  trunkStabilityScore = Math.max(5, trunkStabilityScore);
}

function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
  );
}

function resetPoseDetection(oneFootRaised, armRaised) {
  footInfo.textContent = oneFootRaised ? "" : "Raise one foot higher.";
  armInfo.textContent = armRaised ? "" : "Raise at least one arm.";
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
  if (score >= 9) return "Excellent trunk stability!";
  if (score >= 7)
    return "Good trunk stability. Try to minimize small movements.";
  if (score >= 5)
    return "Moderate trunk stability. Focus on keeping your body steady.";
  return "Work on maintaining a stable posture without swaying.";
}

function showResultPage(resultData) {
  // Hide real-time floating information
  footInfo.style.display = "none";
  armInfo.style.display = "none";
  info.style.display = "none";

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
    info.style.display = "block";
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
