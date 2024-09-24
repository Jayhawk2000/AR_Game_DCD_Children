const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 3000; // 3 seconds
let countdownTimer = 5;
let isDetectionStarted = false;

startButton.addEventListener("click", startProcess);

function startProcess() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

  initCamera().then(() => {
    startCountdown();
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
  if (countdownTimer > 0) {
    info.textContent = `Get ready! ${countdownTimer}`;
    if (countdownTimer === 5) {
      info.textContent += "\nPlease stand where your full body is visible";
    }
    countdownTimer--;
    setTimeout(startCountdown, 1000);
  } else {
    isDetectionStarted = true;
    info.textContent = "Strike a balance pose";
  }
}

function calculateAngle(a, b, c) {
  let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function checkArmRaised(shoulder, elbow, wrist) {
  const angle = calculateAngle(shoulder, elbow, wrist);
  if (angle >= 90) {
    return "excellent";
  } else if (angle >= 45) {
    return "good";
  } else if (angle >= 30) {
    return "raised";
  }
  return "lowered";
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

  if (oneFootRaised && (leftArmStatus !== "lowered" || rightArmStatus !== "lowered")) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      info.textContent = "Hold the pose";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      info.textContent = "Great balance!";
      setTimeout(() => {
        info.textContent = "Try again";
        balancePoseDetected = false;
      }, 2000);
    } else {
      const remainingTime = Math.ceil((BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000);
      info.textContent = `${remainingTime}`;
    }
  } else {
    balancePoseDetected = false;
    if (!oneFootRaised) {
      info.textContent = "Raise one foot higher off the ground";
    } else if (leftArmStatus === "lowered" && rightArmStatus === "lowered") {
      info.textContent = "Raise both arms";
    } else if (leftArmStatus === "lowered") {
      info.textContent = "Raise your left arm more";
    } else if (rightArmStatus === "lowered") {
      info.textContent = "Raise your right arm more";
    } else {
      info.textContent = "Great form! Hold this pose";
    }
  }

  // Provide feedback on arm positions
  if (leftArmStatus === "excellent" && rightArmStatus === "excellent") {
    info.textContent += "\nPerfect arm position!";
  } else if (leftArmStatus === "good" && rightArmStatus === "good") {
    info.textContent += "\nGood arm position, try raising them a bit more";
  }
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks && isDetectionStarted) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "rgba(0, 255, 255, 0.5)",
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "rgba(255, 0, 255, 0.8)",
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
