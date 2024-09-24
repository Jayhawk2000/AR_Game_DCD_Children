const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 3000; // 3 seconds

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
      info.textContent = "Camera activated. Please strike a balance pose.";
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

  const shoulderHeight = (leftShoulder.y + rightShoulder.y) / 2;
  const armsRaised = leftShoulder.y < 0.5 && rightShoulder.y < 0.5;
  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.1;

  if (armsRaised && oneFootRaised) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = Date.now();
    } else {
      const currentTime = Date.now();
      const elapsedTime = currentTime - balancePoseStartTime;

      if (elapsedTime >= BALANCE_POSE_DURATION) {
        info.textContent = "Balance pose held for 3 seconds! Great job!";
        info.style.backgroundColor = "#4CAF50";
      } else {
        info.textContent = `Hold the balance pose for ${Math.ceil(
          (BALANCE_POSE_DURATION - elapsedTime) / 1000
        )} more seconds`;
        info.style.backgroundColor = "#FFA500";
      }
    }
  } else {
    balancePoseDetected = false;
    info.textContent =
      "Please strike a balance pose (arms out, one foot raised)";
    info.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
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
