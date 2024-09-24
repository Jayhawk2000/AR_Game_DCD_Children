const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 3000; // 3 seconds in milliseconds
let countdownTimer = 5; // 5 seconds countdown
let isDetectionStarted = false;

startButton.addEventListener("click", initCamera);

function initCamera() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

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

  camera = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video });
    },
    width: 1280,
    height: 720,
  });

  camera
    .start()
    .then(() => {
      info.textContent = "Camera activated. Get ready!";
      startCountdown();
    })
    .catch((error) => {
      console.error(error);
      info.textContent = "Camera error: " + error.message;
    });
}

function startCountdown() {
  updateCountdown();
}

function updateCountdown() {
  if (countdownTimer > 0) {
    info.textContent = `Get ready! ${countdownTimer}`;
    countdownTimer--;
    setTimeout(updateCountdown, 1000);
  } else {
    info.textContent = "Strike a balance pose";
    isDetectionStarted = true;
  }
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw the camera feed
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (isDetectionStarted && results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "rgba(0, 255, 255, 0.5)",
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "rgba(255, 0, 255, 0.5)",
      lineWidth: 2,
    });

    checkBalancePose(results.poseLandmarks);
  }

  canvasCtx.restore();
}

function checkBalancePose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y) < 0.05;
  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.1;
  const armsRaised =
    leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;
  const hipLevel = Math.abs(leftHip.y - rightHip.y) < 0.05;

  const currentTime = new Date().getTime();

  if (shoulderLevel && oneFootRaised && armsRaised && hipLevel) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      info.textContent = "Great! Hold this pose steady";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      info.textContent = "Excellent balance! You've held it for 3 seconds.";
      setTimeout(() => {
        info.textContent = "Let's try again. Prepare for another balance pose.";
        balancePoseDetected = false;
      }, 3000);
    } else {
      const remainingTime = Math.ceil(
        (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
      );
      info.textContent = `Steady... ${remainingTime} more second${
        remainingTime !== 1 ? "s" : ""
      }`;
    }
  } else {
    balancePoseDetected = false;
    if (!shoulderLevel) {
      info.textContent =
        "Keep your shoulders level. Imagine a straight line between them.";
    } else if (!hipLevel) {
      info.textContent =
        "Align your hips. Think of balancing a tray on your hips.";
    } else if (!oneFootRaised) {
      info.textContent =
        "Lift one foot off the ground. Choose the leg you're most comfortable balancing on.";
    } else if (!armsRaised) {
      info.textContent =
        "Raise both arms to shoulder height. Extend them out to your sides like wings.";
    } else {
      info.textContent =
        "Almost there! Make small adjustments to find your balance.";
    }
  }
}

window.addEventListener("load", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

window.addEventListener("resize", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});
