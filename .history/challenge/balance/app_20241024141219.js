const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const footInfo = document.getElementById("footInfo");
const armInfo = document.getElementById("armInfo");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");
const audioPlayer = document.getElementById("audioPlayer");

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
let isResultShown = false;
let isInitialAudioPlayed = false;  // 添加一个标志来跟踪是否已经播放过初始语音

startButton.addEventListener("click", startProcess);

function startProcess() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

  initCamera()
    .then(() => {
      if (!isInitialAudioPlayed) {
        playAudio("Please stand in a position where your full body is visible. Please follow the on-screen text instructions to complete the action");
        isInitialAudioPlayed = true;
      }
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
        video.style.transform = "scaleX(-1)";
        canvasElement.style.transform = "scaleX(-1)";
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
  const startTime = Date.now();
  const interval = 1000; // 1秒
  
  function updateTimer() {
    const elapsedTime = Date.now() - startTime;
    const remainingSeconds = 5 - Math.floor(elapsedTime / 1000);
    
    if (remainingSeconds >= 0) {
      info.textContent = `Get ready! ${remainingSeconds}`;
      info.innerHTML += "<br>Please stand where your full body is visible";
      
      if (remainingSeconds === 0) {
        isDetectionStarted = true;
        info.textContent = "Strike a balance pose";
      } else {
        setTimeout(updateTimer, interval - (elapsedTime % interval));
      }
    }
  }
  
  updateTimer();
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
  let score = 0;
  if (maxDisplacement < 0.01) score = 100;
  else if (maxDisplacement < 0.02) score = 90;
  else if (maxDisplacement < 0.03) score = 80;
  else if (maxDisplacement < 0.04) score = 70;
  else if (maxDisplacement < 0.05) score = 60;
  else if (maxDisplacement < 0.06) score = 50;
  else if (maxDisplacement < 0.08) score = 40;
  else if (maxDisplacement < 0.1) score = 30;
  else if (maxDisplacement < 0.15) score = 20;
  else if (maxDisplacement < 0.2) score = 10;
  else score = 0;

  return score;
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
        armScore = Math.max(leftArmStatus.score, rightArmStatus.score) * 10; // 转换为100分制
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
  if (score >= 90) return "Excellent arm position!";
  if (score >= 70)
    return "Good arm position. Try to raise your arm a bit higher and extend it more.";
  if (score >= 50)
    return "Moderate arm position. Focus on raising your arm to shoulder level and extending it fully.";
  return "Keep working on raising your arm higher and extending it more.";
}

function getTrunkFeedback(score) {
  if (score === 100)
    return "Perfect stability! You remained incredibly steady.";
  if (score >= 80)
    return "Excellent stability. Very minimal movement detected.";
  if (score >= 60)
    return "Good stability. Some slight movement, but overall well maintained.";
  if (score >= 40)
    return "Fair stability. Try to reduce your body's movement more.";
  if (score >= 20)
    return "Needs improvement. Focus on keeping your body as still as possible.";
  return "Significant movement detected. Practice holding your position steady.";
}

function showResultPage(resultData) {
  isResultShown = true;
  document.getElementById("backButton").style.display = "none";

  info.style.display = "none";
  video.style.display = "none";
  canvasElement.style.display = "none";

  const resultPage = document.getElementById("resultPage");
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

  // 添加语音反馈
  playAudio(`Your score is ${resultData.totalScore.toFixed(1)}. Great job!`);

  const retryButton = document.getElementById("retryButton");
  const returnButton = document.getElementById("returnButton");

  retryButton.textContent = "Try Again";
  returnButton.textContent = "Return to Home";

  retryButton.onclick = () => {
    window.location.reload();
  };

  returnButton.onclick = () => {
    window.location.href = "../../cha_bal.html";
  };
}

function onResults(results) {
  if (isResultShown) return;

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
      color: "rgba(0, 0, 0, 0.0)",
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "rgba(0, 0, 0, 0.0)",
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
    window.location.href = "../../cha_bal.html";
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

function playAudio(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
}