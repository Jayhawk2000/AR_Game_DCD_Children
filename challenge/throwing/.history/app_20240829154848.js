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
  info.textContent = "Please stand with your full body visible";

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

function checkBalancePose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y) < 0.05;
  const hipLevel = Math.abs(leftHip.y - rightHip.y) < 0.05;
  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > 0.1;
  const armsRaised =
    leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;

  const currentTime = Date.now();

  if (shoulderLevel && hipLevel && oneFootRaised && armsRaised) {
    if (!balancePoseDetected) {
      balancePoseDetected = true;
      balancePoseStartTime = currentTime;
      info.textContent = "Excellent! Now hold this balance pose steady";
    } else if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
      info.textContent =
        "Fantastic job! You've held the balance for 3 seconds. That's perfect form!";
      setTimeout(() => {
        info.textContent = "Let's try again. Prepare for another balance pose.";
        balancePoseDetected = false;
      }, 3000);
    } else {
      const remainingTime = Math.ceil(
        (BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000
      );
      info.textContent = `Great balance! Keep holding for ${remainingTime} more second${
        remainingTime !== 1 ? "s" : ""
      }. Stay focused!`;
    }
  } else {
    if (balancePoseDetected) {
      info.textContent = "Balance lost. That's okay, let's try again!";
      balancePoseDetected = false;
    } else {
      if (!shoulderLevel) {
        info.textContent = "Align your shoulders. Keep them level and relaxed.";
      } else if (!hipLevel) {
        info.textContent =
          "Keep your hips straight. Imagine a line connecting them.";
      } else if (!oneFootRaised) {
        info.textContent =
          "Now, slowly raise one foot off the ground. Choose whichever foot feels most comfortable.";
      } else if (!armsRaised) {
        info.textContent =
          "Great! Now raise both arms to shoulder level. Spread them out like wings for better balance.";
      } else {
        info.textContent =
          "You're close! Make small adjustments to find your balance. Focus on a point in front of you.";
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
