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

function checkBalancePose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.05;
  const leftArmStatus = checkArmRaised(leftShoulder, leftElbow, leftWrist);
  const rightArmStatus = checkArmRaised(rightShoulder, rightElbow, rightWrist);

  const currentTime = Date.now();

  if (
    oneFootRaised &&
    (leftArmStatus.status === "raised" || rightArmStatus.status === "raised")
  ) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      initialPose = {
        nose: { ...landmarks[0] },
        leftShoulder: { ...landmarks[11] },
        rightShoulder: { ...landmarks[12] },
        leftHip: { ...landmarks[23] },
        rightHip: { ...landmarks[24] },
      };
      maxDisplacement = 0;
      footInfo.textContent = "Great! Keep your foot raised.";
      armInfo.textContent = "Arm raised, maintain position!";
    } else {
      updateMaxDisplacement(landmarks);

      if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
        armScore = Math.max(leftArmStatus.score, rightArmStatus.score);
        trunkStabilityScore = calculateTrunkStability();
        const totalScore = (armScore + trunkStabilityScore) / 2;
        const resultData = {
          armScore: armScore,
          trunkScore: trunkStabilityScore,
          totalScore: totalScore,
          armFeedback: getArmFeedback(armScore),
          trunkFeedback: getTrunkFeedback(trunkStabilityScore),
          maxDisplacement: maxDisplacement, // Add this line to include maxDisplacement in the result
        };
        showResultPage(resultData);
        // Do not reset maxDisplacement here
      } else {
        const remainingTime = Math.ceil(
          (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
        );
        info.textContent = `Hold steady for ${remainingTime} more seconds!`;
      }
    }
  } else {
    balancePoseDetected = false;
    initialPose = null;
    // Do not reset maxDisplacement here
    resetPoseDetection(
      oneFootRaised,
      leftArmStatus.status === "raised" || rightArmStatus.status === "raised"
    );
  }
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

function showResultPage(resultData) {
  document.getElementById('backButton').style.display = 'none';

  footInfo.style.display = "none";
  armInfo.style.display = "none";
  info.style.display = "none";
  video.style.display = "none";
  canvasElement.style.display = "none";

  const resultPage = document.getElementById("resultPage");
  resultPage.style.display = "block";

  document.getElementById("totalScore").textContent = resultData.totalScore.toFixed(1);
  document.getElementById("armScore").textContent = resultData.armScore.toFixed(1);
  document.getElementById("trunkScore").textContent = resultData.trunkScore.toFixed(1);
  document.getElementById("armFeedback").textContent = resultData.armFeedback;
  document.getElementById("trunkFeedback").textContent = resultData.trunkFeedback;

  const retryButton = document.getElementById("retryButton");
  const returnButton = document.getElementById("returnButton");

  retryButton.textContent = "Try Again";
  returnButton.textContent = "Return to Home";

  retryButton.onclick = () => {
    window.location.reload();
  };

  returnButton.onclick = () => {
    window.location.href = '../index.html'; /////佳灏看这里
  };
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

document.addEventListener("DOMContentLoaded", function () {
  const backButton = document.getElementById("backButton");
  const startButton = document.getElementById("startButton");

  backButton.addEventListener("click", function () {
    window.location.href = "index.html";
  });

  startButton.addEventListener("click", function () {
    backButton.style.display = "block";
    startProcess();
  });
});

window.addEventListener("load", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

window.addEventListener("resize", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});