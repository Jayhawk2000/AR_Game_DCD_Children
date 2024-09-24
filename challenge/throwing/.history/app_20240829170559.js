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

  if (angle >= 160 && heightDiff > 0.1) {
    return "excellent";
  } else if (angle >= 90 && heightDiff > 0.05) {
    return "good";
  } else if (angle >= 45) {
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

  const armsTPosition =
    Math.abs(leftWrist.y - leftShoulder.y) < 0.1 &&
    Math.abs(rightWrist.y - rightShoulder.y) < 0.1;

  const currentTime = Date.now();

  if (oneFootRaised && armsTPosition) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      footInfo.textContent = "Great! Keep your foot raised.";
      armInfo.textContent = "Hold your arm position!";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      const armScore =
        leftArmStatus === rightArmStatus
          ? leftArmStatus
          : `${leftArmStatus}, ${rightArmStatus}`;
      info.textContent = `Congratulations! You held the balance pose! Your arm score: ${armScore}`;
      setTimeout(() => {
        info.textContent = "Try again!";
        footInfo.textContent = "";
        armInfo.textContent = "";
        balancePoseDetected = false;
      }, 2000);
    } else {
      const remainingTime = Math.ceil(
        (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
      );
      info.textContent = `Hold steady for ${remainingTime} more seconds!`;
    }
  } else {
    balancePoseDetected = false;

    if (!oneFootRaised) {
      footInfo.textContent = "Raise one foot higher off the ground.";
    } else {
      footInfo.textContent = "Great! Keep your foot raised.";
    }

    if (!armsTPosition) {
      armInfo.textContent = "Extend your arms in a 'T' shape.";
    }
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
