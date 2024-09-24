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

function checkArmRaised(shoulder, elbow, wrist) {
  const angle = calculateAngle(shoulder, elbow, wrist);
  const heightDiff = shoulder.y - wrist.y;
  const shoulderToWristDist = calculateDistance(shoulder, wrist);
  const shoulderToElbowDist = calculateDistance(shoulder, elbow);

  // Check if arm is parallel to the ground
  const isParallel = Math.abs(wrist.y - shoulder.y) < 0.05;

  // Check if arm is extended
  const isExtended = shoulderToWristDist > shoulderToElbowDist * 1.8;

  if (isParallel && isExtended) {
    return { status: "raised", score: 10 };
  } else if (isParallel) {
    return { status: "raised", score: 8 };
  } else if (angle >= 150 && heightDiff > 0) {
    return { status: "raised", score: 7 };
  } else if (angle >= 120 && heightDiff > 0) {
    return { status: "raised", score: 6 };
  } else if (angle >= 90) {
    return { status: "raised", score: 5 };
  }
  return { status: "lowered", score: 0 };
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
  const headForward = checkHeadForward(nose, leftShoulder, rightShoulder);

  updateStabilityScores(
    leftWrist,
    rightWrist,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip
  );

  const currentTime = Date.now();

  if (
    oneFootRaised &&
    (leftArmStatus.status === "raised" || rightArmStatus.status === "raised") &&
    headForward
  ) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      footInfo.textContent = "Great! Keep your foot raised.";
      armInfo.textContent = "Arm raised, maintain position!";
      headInfo.textContent = "Good head position!";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      const armExtensionScore = Math.max(
        leftArmStatus.score,
        rightArmStatus.score
      );
      const totalScore =
        (armStabilityScore + trunkStabilityScore + armExtensionScore) / 3;
      const resultData = {
        armScore: armStabilityScore,
        trunkScore: trunkStabilityScore,
        armExtensionScore: armExtensionScore,
        totalScore: totalScore,
        armFeedback: getArmFeedback(armStabilityScore),
        trunkFeedback: getTrunkFeedback(trunkStabilityScore),
        armExtensionFeedback: getArmExtensionFeedback(armExtensionScore),
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
      leftArmStatus.status === "raised" || rightArmStatus.status === "raised",
      headForward
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
  const trunkStable = Math.abs(shoulderMidpoint.x - hipMidpoint.x) < 0.05;
  trunkInfo.textContent = trunkStable
    ? "Trunk stable"
    : "Keep your trunk steady";
  return trunkStable;
}

function updateStabilityScores(
  leftWrist,
  rightWrist,
  leftShoulder,
  rightShoulder,
  leftHip,
  rightHip
) {
  // Arm stability
  if (prevWristPositions.left && prevWristPositions.right) {
    const leftMovement = calculateDistance(leftWrist, prevWristPositions.left);
    const rightMovement = calculateDistance(
      rightWrist,
      prevWristPositions.right
    );
    const totalMovement = leftMovement + rightMovement;

    // Even less strict scoring for arm stability
    armStabilityScore = Math.max(0, armStabilityScore - totalMovement * 0);
  }

  prevWristPositions = { left: leftWrist, right: rightWrist };

  // Trunk stability
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMidpoint = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };

  const trunkMovement = calculateDistance(shoulderMidpoint, hipMidpoint);

  // Much less strict scoring for trunk stability
  trunkStabilityScore = Math.max(0, 10 - trunkMovement * 50);

  // More rapid recovery of stability scores
  armStabilityScore = Math.min(10, armStabilityScore + 0.2);
  trunkStabilityScore = Math.min(10, trunkStabilityScore + 0.2);

  // Ensure scores don't drop below 5 too easily
  armStabilityScore = Math.max(5, armStabilityScore);
  trunkStabilityScore = Math.max(5, trunkStabilityScore);
}

function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
  );
}

function getArmExtensionFeedback(score) {
  if (score >= 9)
    return "Excellent arm position! Parallel to the ground and fully extended.";
  if (score >= 7)
    return "Great arm position! Try to extend your arm a bit more.";
  if (score >= 5)
    return "Good effort! Raise your arm higher and try to keep it straight.";
  return "Keep working on raising your arm higher and extending it fully.";
}

function resetPoseDetection(oneFootRaised, armRaised, headForward) {
  footInfo.textContent = oneFootRaised ? "" : "Raise one foot higher.";
  armInfo.textContent = armRaised ? "" : "Raise at least one arm.";
  headInfo.textContent = headForward ? "" : "Look straight ahead.";
}

function getArmFeedback(score) {
  if (score >= 9) return "Excellent arm stability!";
  if (score >= 7) return "Good arm stability, minor movements detected.";
  if (score >= 5) return "Moderate arm stability, try to minimize movements.";
  return "Focus on keeping your arm more steady.";
}

function getTrunkFeedback(score) {
  if (score >= 9) return "Excellent trunk stability!";
  if (score >= 7) return "Good trunk stability, minor movements detected.";
  if (score >= 5) return "Moderate trunk stability, try to minimize movements.";
  return "Focus on keeping your body more steady.";
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
  document.getElementById("armExtensionScore").textContent =
    resultData.armExtensionScore.toFixed(1);
  document.getElementById("armFeedback").textContent = resultData.armFeedback;
  document.getElementById("trunkFeedback").textContent =
    resultData.trunkFeedback;
  document.getElementById("armExtensionFeedback").textContent =
    resultData.armExtensionFeedback;

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
