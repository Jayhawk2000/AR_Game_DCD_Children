const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let isDetectionStarted = false;
let countdownTimer = 5;
let detector;
let startTime;
let throwDetected = false;
let resultDisplayed = false;

const audioPlayer = document.getElementById("audioPlayer");

let isInitialAudioPlayed = false;  // 添加一个标志来跟踪是否已经播放过初始语音

function playAudio(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

class PoseDetector {
  constructor() {
    this.isInStartingPosition = false;
    this.startingPositionHoldTime = 0;
    this.STARTING_POSITION_HOLD_DURATION = 3000; // 3 seconds
    this.throwingStarted = false;
    this.throwingCompleted = false;
    this.initialWristPosition = null;
    this.initialFootPosition = null;
    this.countdownTimer = 3;
    this.throwStartTime = 0;
  }

  checkStartingPosition(landmarks) {
    const isSideOn = this.checkSideOnStance(landmarks);
    const isArmBehindHead = this.checkArmBehindHead(landmarks);

    if (isSideOn && isArmBehindHead) {
      const currentTime = Date.now();
      if (this.startingPositionHoldTime === 0) {
        this.startingPositionHoldTime = currentTime;
        this.countdownTimer = 3;
      } else {
        const elapsedTime = currentTime - this.startingPositionHoldTime;
        this.countdownTimer = 3 - Math.floor(elapsedTime / 1000);

        if (this.countdownTimer > 0) {
          info.textContent = `Hold position for: ${this.countdownTimer}`;
        } else {
          this.isInStartingPosition = true;
          info.textContent = "Starting position held. Begin throwing!";
          this.initialFootPosition = this.getFootPosition(landmarks);
        }
      }
    } else {
      this.startingPositionHoldTime = 0;
      this.updateStartingPositionFeedback(isSideOn, isArmBehindHead);
    }

    return this.isInStartingPosition;
  }

  updateStartingPositionFeedback(isSideOn, isArmBehindHead) {
    if (!isSideOn) {
      info.textContent = "Please turn sideways to the camera";
    } else if (!isArmBehindHead) {
      info.textContent = "Please place one hand behind your head";
    } else {
      info.textContent = "Great! Hold this position";
    }
  }

  checkSideOnStance(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const shoulderDiff = Math.abs(leftShoulder.z - rightShoulder.z);
    const hipDiff = Math.abs(leftHip.z - rightHip.z);

    return shoulderDiff > 0.1 && hipDiff > 0.1;
  }

  checkArmBehindHead(landmarks) {
    const nose = landmarks[0];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const head = landmarks[0]; // Using nose as reference for head

    return (
      (leftWrist.x < head.x && leftWrist.y < head.y) ||
      (rightWrist.x < head.x && rightWrist.y < head.y)
    );
  }

  getFootPosition(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    return { left: leftAnkle, right: rightAnkle };
  }

  checkThrowingPose(landmarks) {
    const nose = landmarks[0];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!this.throwingStarted) {
      this.throwingStarted = true;
      this.initialWristPosition =
        leftWrist.x < rightWrist.x ? leftWrist : rightWrist;
      this.throwStartTime = Date.now();
    }

    if (leftWrist.x > nose.x && rightWrist.x > nose.x) {
      this.throwingCompleted = true;
      const throwingScore = this.calculateThrowingScore(landmarks);
      const footStepScore = this.calculateFootStepScore(landmarks);
      return { throwingScore, footStepScore };
    }

    return null;
  }

  calculateThrowingScore(landmarks) {
    // 在镜像环境下，需要反转左右手腕的判断
    const throwingWrist =
      landmarks[15].x < landmarks[16].x ? landmarks[15] : landmarks[16];
    const throwDuration = (Date.now() - this.throwStartTime) / 1000;

    const horizontalDistance = Math.abs(
      throwingWrist.x - this.initialWristPosition.x
    );
    const speed = horizontalDistance / throwDuration;

    // 放宽速度范围，给予更高的分数
    if (speed >= 0.1 && speed <= 4.0) {
      return 100;
    } else {
      // 如果速度不在理想范围内，也给予较高的分数
      return Math.max(this.mapRange(speed, 0, 5, 60, 100), 60);
    }
  }

  calculateFootStepScore(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    const footDistance = Math.abs(leftAnkle.x - rightAnkle.x);

    // 如果脚之间有明显距离，给予满分
    if (footDistance > 0.05) {
      return 100;
    } else {
      // 如果脚的距离不够明显，给予部分分数，但最低不少于60分
      return Math.max(this.mapRange(footDistance, 0, 0.05, 60, 100), 60);
    }
  }

  mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }
}

const poseDetector = new PoseDetector();

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
    try {
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
          reject(error);
        });
    } catch (error) {
      console.error("Error in initCamera:", error);
      reject(error);
    }
  });
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // 绘制视频帧
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.poseLandmarks && isDetectionStarted) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 4
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "#FF0000",
      lineWidth: 2
    });

    if (!poseDetector.isInStartingPosition) {
      poseDetector.checkStartingPosition(results.poseLandmarks);
    } else if (!poseDetector.throwCompleted) {
      const scores = poseDetector.checkThrowingPose(results.poseLandmarks);
      if (scores !== null) {
        const totalScore = (scores.throwingScore + scores.footStepScore) / 2;
        showResultPage(totalScore, scores.throwingScore, scores.footStepScore);
        isDetectionStarted = false;
      }
    }
  }
  
  canvasCtx.restore();
}

function showResultPage(totalScore, throwingScore, footStepScore) {
  document.getElementById("backButton").style.display = "none";

  info.style.display = "none";
  video.style.display = "none";
  canvasElement.style.display = "none";

  const resultPage = document.getElementById("resultPage");
  resultPage.style.display = "block";

  document.getElementById("totalScore").textContent = totalScore.toFixed(1);
  document.getElementById("throwingScore").textContent = throwingScore.toFixed(1);
  document.getElementById("footStepScore").textContent = footStepScore.toFixed(1);
  document.getElementById("throwingFeedback").textContent = getThrowingFeedback(totalScore);

  // 添加语音反馈
  playAudio(`Your score is ${totalScore.toFixed(1)}. Great job!`);

  const retryButton = document.getElementById("retryButton");
  const returnButton = document.getElementById("returnButton");

  retryButton.textContent = "Try Again";
  returnButton.textContent = "Return to Home";

  retryButton.onclick = () => {
    window.location.reload();
  };

  returnButton.onclick = () => {
    window.location.href = "../../cha_throw.html";
  };
}

function getThrowingFeedback(score) {
  if (score >= 90) return "Excellent throwing form!";
  if (score >= 80) return "Very good throw, with some room for improvement.";
  if (score >= 70) return "Good attempt, keep practicing to improve your form.";
  return "Keep practicing! Focus on your arm movement and foot positioning.";
}

document.addEventListener("DOMContentLoaded", function () {
  const backButton = document.getElementById("backButton");
  const startButton = document.getElementById("startButton");

  backButton.addEventListener("click", function () {
    window.location.href = "../../cha_throw.html";
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
        info.textContent = "Please turn sideways to the camera";
      } else {
        setTimeout(updateTimer, interval - (elapsedTime % interval));
      }
    }
  }
  
  updateTimer();
}
