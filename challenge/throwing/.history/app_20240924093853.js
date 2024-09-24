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
const JUMP_PREPARE_DURATION = 3000; // 3秒钟准备时间
const MIN_JUMP_HEIGHT = 0.2; // 最小跳跃高度

startButton.addEventListener("click", startProcess);

function startProcess() {
  startButton.style.display = "none";
  info.textContent = "初始化摄像头中...";

  initCamera()
    .then(() => {
      startCountdown();
    })
    .catch((error) => {
      console.error("初始化失败:", error);
      info.textContent = "摄像头或姿态检测初始化失败。";
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
        console.log("摄像头启动成功");
        video.style.display = "block";
        canvasElement.style.display = "block";
        resolve();
      })
      .catch((error) => {
        console.error("摄像头启动错误:", error);
        info.textContent = "摄像头启动错误: " + error.message;
        reject(error);
      });
  });
}

function startCountdown() {
  info.textContent = `准备好！ ${countdownTimer}`;
  info.innerHTML += "<br>请站在摄像头前，确保全身可见";

  if (countdownTimer > 0) {
    countdownTimer--;
    setTimeout(startCountdown, 1000);
  } else {
    isDetectionStarted = true;
    info.textContent = "准备跳跃，请双脚微微张开并稍微屈膝！";
    jumpPhase = "preparation";
  }
}

function checkJumpPreparation(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  // 检查双脚是否张开
  const feetApart = Math.abs(leftAnkle.x - rightAnkle.x) > 0.1;

  // 检查双膝是否弯曲（髋-膝-踝角度 < 160度）
  const leftKneeBent = calculateAngle(leftHip, leftKnee, leftAnkle) < 160;
  const rightKneeBent = calculateAngle(rightHip, rightKnee, rightAnkle) < 160;

  return feetApart && leftKneeBent && rightKneeBent;
}

function checkJumpingPose(landmarks) {
  if (!isJumpingStarted) {
    if (checkJumpPreparation(landmarks)) {
      const currentTime = Date.now();
      if (jumpStartTime === 0) {
        jumpStartTime = currentTime;
      } else if (currentTime - jumpStartTime >= JUMP_PREPARE_DURATION) {
        isJumpingStarted = true;
        info.textContent = "准备好了！请跳跃！";
      }
    } else {
      jumpStartTime = 0;
      info.textContent = "请确保双脚微微张开并稍微屈膝。";
    }
    return;
  }

  // 检测跳跃高度和落地
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
  const currentY = landmarks[27].y; // 左脚踝的Y坐标
  return initialY - currentY; // 跳跃高度
}

function checkFeetApartOnLanding(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  return Math.abs(leftAnkle.x - rightAnkle.x) > 0.1; // 落地时双脚张开
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

    checkJumpingPose(results.poseLandmarks); // 检查跳跃姿势
    updateInfoDisplay();
  }

  canvasCtx.restore();
}

function updateInfoDisplay() {
  info.textContent = `当前阶段: ${jumpPhase}`;
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
    info.textContent = '点击 "开始" 开始';
  });
}

function getJumpingFeedback(score) {
  if (score >= 90) return "跳跃姿势非常棒！";
  if (score >= 75) return "跳得不错，还有进步空间。";
  if (score >= 60) return "跳跃不错，继续练习提高姿势。";
  if (score >= 40) return "跳跃尚可，专注于提高技术。";
  return "继续加油！专注于正确的跳跃姿势。";
}
