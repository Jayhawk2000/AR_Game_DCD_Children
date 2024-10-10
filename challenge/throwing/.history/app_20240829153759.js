const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");
const overlay = document.getElementById("overlay");

let pose, camera;
let balancePoseDetected = false;
let balancePoseStartTime = 0;
const BALANCE_POSE_DURATION = 3000; // 3 seconds
let countdownTimer = 5;

startButton.addEventListener("click", startProcess);

function startProcess() {
  startButton.style.display = "none";
  info.textContent = "Initializing camera...";

  initCamera().then(() => {
    overlay.style.display = "block";
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

    camera
      .start()
      .then(() => {
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
    info.textContent = `Get ready! Starting in ${countdownTimer} seconds`;
    countdownTimer--;
    setTimeout(startCountdown, 1000);
  } else {
    startDetection();
  }
}

function startDetection() {
  info.textContent = "Stand in the detection zone";

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
      color: "rgba(0, 255, 0, 0.5)",
      lineWidth: 2,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "rgba(255, 0, 0, 0.8)",
      lineWidth: 1,
      radius: 3,
    });

    checkBalancePose(results.poseLandmarks);
  }

  canvasCtx.restore();
}

function checkBalancePose(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.1;
  const armsRaised =
    leftWrist.y < 0.6 &&
    rightWrist.y < 0.6 &&
    Math.abs(leftWrist.y - rightWrist.y) < 0.1;

  const currentTime = Date.now();

  if (oneFootRaised && armsRaised) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      info.textContent = "Great! Hold this pose";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      info.textContent = "Excellent! You held the balance for 3 seconds.";
      setTimeout(() => {
        info.textContent = "Try again! Strike a balance pose.";
        balancePoseDetected = false;
      }, 2000);
    } else {
      const remainingTime = Math.ceil(
        (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
      );
      info.textContent = `Great! Keep holding for ${remainingTime} more second${
        remainingTime !== 1 ? "s" : ""
      }`;
    }
  } else {
    if (balancePoseDetected) {
      info.textContent = "Balance lost. Try again!";
      balancePoseDetected = false;
    } else {
      if (!oneFootRaised) {
        info.textContent = "Try raising one foot off the ground";
      } else if (!armsRaised) {
        info.textContent = "Now, raise both arms to shoulder level";
      } else {
        info.textContent = "Almost there! Adjust your pose slightly";
      }
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
