const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const footInfo = document.getElementById("footInfo");
const armInfo = document.getElementById("armInfo");
const headInfo = document.getElementById("headInfo");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 5000; // 5秒倒计时
let countdownTimer = 5;
let isDetectionStarted = false;
let prevWristPositions = { left: null, right: null };
let armStabilityScore = 10;
let trunkStabilityScore = 10;

startButton.addEventListener("click", startProcess);

function startProcess() {
  startButton.style.display = "none";
  info.textContent = "初始化摄像头...";

  // 重置状态
  resetState();

  initCamera()
    .then(() => {
      startCountdown();
    })
    .catch((error) => {
      console.error("初始化失败:", error);
      info.textContent = "无法初始化摄像头或姿势检测。";
    });
}

function resetState() {
  // 重置所有状态
  balancePoseDetected = false;
  balancePoseStartTime = 0;
  countdownTimer = 5;
  isDetectionStarted = false;
  prevWristPositions = { left: null, right: null };
  armStabilityScore = 10;
  trunkStabilityScore = 10;
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
        console.error("启动摄像头时出错:", error);
        info.textContent = "启动摄像头时出错：" + error.message;
        reject(error);
      });
  });
}

function startCountdown() {
  info.textContent = `准备好! ${countdownTimer}`;
  info.innerHTML += "<br>请确保身体全貌在画面中可见";

  if (countdownTimer > 0) {
    countdownTimer--;
    setTimeout(startCountdown, 1000);
  } else {
    isDetectionStarted = true; // 确保只设置一次
    info.textContent = "请保持平衡姿势";
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

  // 手腕高于肩膀即认为抬起
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
      footInfo.textContent = "很好! 请保持单脚抬起。";
      armInfo.textContent = "手臂抬起!";
      headInfo.textContent = "头部朝向正确!";
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
      info.textContent = `再坚持 ${remainingTime} 秒!`;
    }
  } else {
    balancePoseDetected = false;
    resetPoseDetection(
      oneFootRaised,
      leftArmStatus,
      rightArmStatus,
      headForward
    );
  }
}

function updateStabilityScores(leftWrist, rightWrist) {
  if (prevWristPositions.left && prevWristPositions.right) {
    const leftMovement = calculateDistance(leftWrist, prevWristPositions.left);
    const rightMovement = calculateDistance(
      rightWrist,
      prevWristPositions.right
    );
    const totalMovement = leftMovement + rightMovement;

    // 加严打分，减少更多分数
    armStabilityScore = Math.max(0, 10 - totalMovement * 150);
  }

  prevWristPositions = { left: leftWrist, right: rightWrist };
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
  const trunkStable = Math.abs(shoulderMidpoint.x - hipMidpoint.x) < 0.03; // 更严格的阈值

  // 不在检测阶段显示任何信息，只影响打分
  trunkStabilityScore = trunkStable
    ? trunkStabilityScore
    : trunkStabilityScore - 1;

  return trunkStable;
}

function getArmFeedback(
  score,
  leftWrist,
  rightWrist,
  leftShoulder,
  rightShoulder
) {
  const leftArmExtended = Math.abs(leftWrist.y - leftShoulder.y) < 0.1;
  const rightArmExtended = Math.abs(rightWrist.y - rightShoulder.y) < 0.1;

  if (score >= 9 && leftArmExtended && rightArmExtended)
    return "手臂稳定且完全伸展!";
  if (score >= 9) return "手臂稳定!";
  if (score >= 7) return "手臂稳定性好，有轻微移动。";
  if (score >= 5) return "手臂稳定性中等，尽量减少移动。";
  return "手臂移动较多，请注意保持手臂稳定。";
}

function resetPoseDetection(
  oneFootRaised,
  leftArmStatus,
  rightArmStatus,
  headForward
) {
  footInfo.textContent = oneFootRaised ? "" : "请抬高一只脚。";
  armInfo.textContent =
    leftArmStatus === "raised" && rightArmStatus === "raised"
      ? ""
      : "请抬起手臂。";
  headInfo.textContent = headForward ? "" : "请保持头部正对前方。";
}

function showResultPage(resultData) {
  // 隐藏实时信息
  footInfo.style.display = "none";
  armInfo.style.display = "none";
  headInfo.style.display = "none";
  info.style.display = "none"; // 隐藏倒计时信息

  // 隐藏视频和画布
  video.style.display = "none";
  canvasElement.style.display = "none";

  // 显示结果页面
  const resultPage = document.getElementById("resultPage");
  resultPage.style.display = "block";

  // 更新结果页面内容
  document.getElementById("totalScore").textContent =
    resultData.totalScore.toFixed(1);
  document.getElementById("armScore").textContent =
    resultData.armScore.toFixed(1);
  document.getElementById("trunkScore").textContent =
    resultData.trunkScore.toFixed(1);
  document.getElementById("armFeedback").textContent = resultData.armFeedback;
  document.getElementById("trunkFeedback").textContent =
    resultData.trunkFeedback;

  // 移除并重新添加点击事件监听器，避免重复添加
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
    info.style.display = "block"; // 重置为新会话
    info.textContent = '点击 "Start" 开始';
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
