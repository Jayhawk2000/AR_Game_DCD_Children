const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 3000; // 3 seconds in milliseconds

startButton.addEventListener("click", initCamera);

function initCamera() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    info.textContent =
      "Your browser doesn't support getUserMedia. Please try a different browser.";
    return;
  }

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
      info.textContent = "Camera activated, please strike a balance pose";
    })
    .catch((error) => {
      console.error(error);
      info.textContent = "Camera initialization failed: " + error.message;
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

  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "#FF0000",
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

  const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y) < 0.05;
  const oneFootRaised =
    Math.abs(leftAnkle.y - rightAnkle.y) > 0.1 &&
    (leftAnkle.visibility > 0.5 || rightAnkle.visibility > 0.5);

  const currentTime = new Date().getTime();

  if (shoulderLevel && oneFootRaised) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      info.textContent = "Balance pose detected! Hold for 3 seconds...";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      info.textContent = "Great job! Balance pose held for 3 seconds.";
      setTimeout(() => {
        info.textContent = "Try the balance pose again.";
        balancePoseDetected = false;
      }, 2000);
    } else {
      const remainingTime = Math.ceil(
        (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
      );
      info.textContent = `Hold the pose for ${remainingTime} more second${
        remainingTime !== 1 ? "s" : ""
      }...`;
    }
  } else {
    if (balancePoseDetected) {
      info.textContent = "Balance lost. Please try again.";
      balancePoseDetected = false;
    } else {
      info.textContent = "Please strike a balance pose (arms out, one foot up)";
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
