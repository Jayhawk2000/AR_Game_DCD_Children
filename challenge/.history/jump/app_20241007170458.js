const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let isDetectionStarted = false;
let countdownTimer = 5;

class PoseDetector {
  constructor() {
    this.isInStartingPosition = false;
    this.startingPositionHoldTime = 0;
    this.STARTING_POSITION_HOLD_DURATION = 3000;
    this.jumpStarted = false;
    this.jumpCompleted = false;
    this.initialFootPosition = null;
    this.highestPoint = null;
    this.countdownTimer = 3;
    this.jumpStartTime = 0;
    this.jumpDetectionStarted = false;
    this.minimumJumpHeight = 0.05;
    this.maximumJumpDuration = 2000;
  }

  checkStartingPosition(landmarks) {
    const isFeetSlightlyApart = this.checkFeetApart(landmarks);
    const isSlightlyBentKnees = this.checkBentKnees(landmarks);

    if (isFeetSlightlyApart && isSlightlyBentKnees) {
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
          info.textContent = "Starting position held. Jump now!";
          this.initialFootPosition = this.getFootPosition(landmarks);
        }
      }
    } else {
      this.startingPositionHoldTime = 0;
      this.updateStartingPositionFeedback(
        isFeetSlightlyApart,
        isSlightlyBentKnees
      );
    }

    return this.isInStartingPosition;
  }

  updateStartingPositionFeedback(isFeetSlightlyApart, isSlightlyBentKnees) {
    if (!isFeetSlightlyApart) {
      info.textContent = "Please stand with your feet slightly apart";
    } else if (!isSlightlyBentKnees) {
      info.textContent = "Please bend your knees slightly";
    } else {
      info.textContent = "Great! Hold this position";
    }
  }

  checkFeetApart(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const distance = Math.abs(leftAnkle.x - rightAnkle.x);
    return distance > 0.1 && distance < 0.3;
  }

  checkBentKnees(landmarks) {
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];

    const leftKneeAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle);

    return leftKneeAngle < 170 && rightKneeAngle < 170;
  }

  calculateAngle(a, b, c) {
    const radians =
      Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  }

  getFootPosition(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    return { left: leftAnkle, right: rightAnkle };
  }

  checkJumpingPose(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const currentTime = Date.now();

    if (!this.jumpDetectionStarted) {
      const currentFootPosition = this.getFootPosition(landmarks);
      if (
        currentFootPosition.left.y <
          this.initialFootPosition.left.y - this.minimumJumpHeight &&
        currentFootPosition.right.y <
          this.initialFootPosition.right.y - this.minimumJumpHeight
      ) {
        this.jumpDetectionStarted = true;
        this.jumpStarted = true;
        this.highestPoint = null;
        this.jumpStartTime = currentTime;
        info.textContent = "Jump detected!";
      }
      return null;
    }

    const currentHeight = (leftAnkle.y + rightAnkle.y) / 2;

    if (this.highestPoint === null || currentHeight < this.highestPoint) {
      this.highestPoint = currentHeight;
    }

    if (
      (leftAnkle.y > this.initialFootPosition.left.y &&
        rightAnkle.y > this.initialFootPosition.right.y) ||
      currentTime - this.jumpStartTime > this.maximumJumpDuration
    ) {
      if (
        this.initialFootPosition.left.y - this.highestPoint >
        this.minimumJumpHeight
      ) {
        this.jumpCompleted = true;
        const jumpHeightScore = this.calculateJumpHeightScore();
        const landingScore = this.calculateLandingScore(landmarks);
        return { jumpHeightScore, landingScore };
      } else {
        this.resetJumpDetection();
        info.textContent = "Jump not detected. Please try again.";
      }
    }

    return null;
  }

  resetJumpDetection() {
    this.jumpDetectionStarted = false;
    this.jumpStarted = false;
    this.jumpCompleted = false;
    this.highestPoint = null;
  }

  calculateJumpHeightScore() {
    const jumpHeight = Math.abs(
      this.initialFootPosition.left.y - this.highestPoint
    );

    if (jumpHeight > 0.1) {
      return 100;
    } else {
      return Math.max(this.mapRange(jumpHeight, 0, 0.1, 60, 100), 60);
    }
  }

  calculateLandingScore(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const landingDistance = Math.abs(leftAnkle.x - rightAnkle.x);

    if (landingDistance > 0.1) {
      return 100;
    } else {
      return Math.max(this.mapRange(landingDistance, 0, 0.1, 60, 100), 60);
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
    info.textContent = "Please assume the starting position";
  }
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

    if (!poseDetector.isInStartingPosition) {
      poseDetector.checkStartingPosition(results.poseLandmarks);
    } else if (!poseDetector.jumpCompleted) {
      const scores = poseDetector.checkJumpingPose(results.poseLandmarks);
      if (scores !== null) {
        const totalScore = (scores.jumpHeightScore + scores.landingScore) / 2;
        showResultPage(totalScore, scores.jumpHeightScore, scores.landingScore);
        isDetectionStarted = false;
      } else if (poseDetector.jumpStarted && !poseDetector.jumpCompleted) {
        info.textContent = "Jump in progress...";
      }
    }
  }

  canvasCtx.restore();
}

function showResultPage(totalScore, jumpHeightScore, landingScore) {
  info.style.display = "none";
  video.style.display = "none";
  canvasElement.style.display = "none";

  const resultPage = document.getElementById("resultPage");
  resultPage.style.display = "block";

  document.getElementById("totalScore").textContent = totalScore.toFixed(1);
  document.getElementById("jumpHeightScore").textContent =
    jumpHeightScore.toFixed(1);
  document.getElementById("landingScore").textContent = landingScore.toFixed(1);
  document.getElementById("jumpFeedback").textContent =
    getJumpFeedback(totalScore);

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

function getJumpFeedback(score) {
  if (score >= 90) return "Excellent jump! Great height and landing!";
  if (score >= 80) return "Very good jump, with some room for improvement.";
  if (score >= 70)
    return "Good attempt, keep practicing to improve your jump height and landing.";
  return "Keep practicing! Focus on getting more height and landing with your feet apart.";
}

document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('backButton');
    const startButton = document.getElementById('startButton');
    
    backButton.addEventListener('click', function() {
        window.location.href = 'index.html';
    });

    startButton.addEventListener('click', function() {
        // 显示返回按钮
        backButton.style.display = 'block';
        
        // 原有的开始检测逻辑
        // ...
    });

    // 其他现有代码
});

window.addEventListener("load", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

window.addEventListener("resize", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});
