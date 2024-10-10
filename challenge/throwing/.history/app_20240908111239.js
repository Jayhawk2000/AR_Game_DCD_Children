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

let armScore = 0;
let bodyScore = 0;

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

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks && isDetectionStarted) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "rgba(0, 255, 255, 0.0)", // 将颜色的 alpha 设为 0，使其透明
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "rgba(255, 0, 255, 0.0)", // 将颜色的 alpha 设为 0，使其透明
      lineWidth: 2,
      radius: 6,
    });

    checkBalancePose(results.poseLandmarks);
  }

  canvasCtx.restore();
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

  const leftEye = landmarks[1];
  const rightEye = landmarks[4];
  
  // Check for head looking forward
  const headForward = Math.abs(leftEye.x - rightEye.x) < 0.05;

  // Check for one foot raised
  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.05;

  // Check arm positions (T-shape)
  const leftArmStatus = checkArmRaised(leftShoulder, leftElbow, leftWrist);
  const rightArmStatus = checkArmRaised(rightShoulder, rightElbow, rightWrist);

  const armsTPosition = leftArmStatus === "excellent" && rightArmStatus === "excellent";

  // Arm stability calculation based on wrist movement
  const leftArmStable = Math.abs(leftWrist.x - leftShoulder.x) < 0.05;
  const rightArmStable = Math.abs(rightWrist.x - rightShoulder.x) < 0.05;
  
  // Calculate body stability based on shoulder and hip movement
  const bodyStable = Math.abs(landmarks[23].y - landmarks[24].y) < 0.05;

  const currentTime = Date.now();

  // Ensure conditions for starting balance timer
  if (oneFootRaised && armsTPosition && headForward) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      footInfo.textContent = "Great! Keep your foot raised.";
      armInfo.textContent = "Hold your arm position and stay still!";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      armScore = leftArmStable && rightArmStable ? 10 : 8;
      bodyScore = bodyStable ? 10 : 8;

      const totalScore = (armScore + bodyScore) / 2;

      // Store score and navigate to results page
      sessionStorage.setItem("totalScore", totalScore.toFixed(1));
      window.location.href = "results.html";
    } else {
      const remainingTime = Math.ceil((BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000);
      info.textContent = `Hold steady for ${remainingTime} more seconds!`;
    }
  } else {
    balancePoseDetected = false;
    footInfo.textContent = oneFootRaised ? "Keep your foot raised." : "Raise one foot higher off the ground.";
    armInfo.textContent = armsTPosition ? "Hold your arms steady." : "Extend your arms in a 'T' shape.";
    info.textContent = headForward ? "" : "Look straight ahead.";
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
  const heightDiff = shoulder.y - wrist.y;

  if (angle >= 150 && heightDiff > 0.05) {
    return "excellent";
  } else if (angle >= 120 && heightDiff > 0) {
    return "good";
  } else if (angle >= 90) {
    return "raised";
  }
  return "lowered";
}

window.addEventListener("load", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

window.addEventListener("resize", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});
