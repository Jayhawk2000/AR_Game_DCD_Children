const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let hands, camera;
let fistDetected = false;
let lastFistDetectionTime = 0;

startButton.addEventListener("click", initCamera);

function initCamera() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    },
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onResults);

  camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 1280,
    height: 720,
  });

  camera
    .start()
    .then(() => {
      info.textContent = "Camera activated, please make a fist gesture";
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

  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5,
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
    }

    checkFist(results.multiHandLandmarks[0]);
  }

  canvasCtx.restore();
}

function checkFist(landmarks) {
  if (landmarks) {
    const thumbTip = landmarks[4];
    const indexFingerTip = landmarks[8];
    const distance = calculateDistance(thumbTip, indexFingerTip);

    const currentTime = new Date().getTime();
    if (distance < 0.1) {
      if (!fistDetected && currentTime - lastFistDetectionTime > 2000) {
        fistDetected = true;
        lastFistDetectionTime = currentTime;
        info.textContent =
          "Fist detected! Keep holding or try another gesture.";
        setTimeout(() => {
          info.textContent = "Please continue to make fists or other gestures";
          fistDetected = false;
        }, 2000);
      }
    } else {
      if (currentTime - lastFistDetectionTime > 2000) {
        info.textContent = "Please make a fist gesture";
      }
    }
  }
}

function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) +
      Math.pow(point1.y - point2.y, 2) +
      Math.pow(point1.z - point2.z, 2)
  );
}

window.addEventListener("load", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});

window.addEventListener("resize", () => {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
});
