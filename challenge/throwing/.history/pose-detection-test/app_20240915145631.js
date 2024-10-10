const startButton = document.getElementById("startButton");
const info = document.getElementById("info");
const footInfo = document.getElementById("footInfo");
const armInfo = document.getElementById("armInfo");
const video = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");

let camera;
let isDetectionStarted = false;
let countdownTimer = 5;
let ws;

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
        if (isDetectionStarted) {
          canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
          const imageData = canvasElement.toDataURL('image/jpeg');
          ws.send(JSON.stringify({ type: 'frame', image: imageData }));
        }
      },
      width: 640,
      height: 480,
    });

    camera.start()
      .then(() => {
        console.log("Camera started successfully");
        video.style.display = "none";
        canvasElement.style.display = "block";
        initWebSocket();
        resolve();
      })
      .catch((error) => {
        console.error("Error starting camera:", error);
        info.textContent = "Error starting camera: " + error.message;
        reject(error);
      });
  });
}

function initWebSocket() {
  ws = new WebSocket('ws://localhost:3000');

  ws.onopen = () => {
    console.log('WebSocket连接已建立');
    ws.send(JSON.stringify({ type: 'start' }));
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'result') {
      handlePoseResult(message.data);
    } else if (message.type === 'error') {
      console.error('API错误:', message.message);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket连接已关闭');
  };
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

function handlePoseResult(result) {
  // 处理API返回的结果，更新UI
  if (result.message) {
    info.textContent = result.message;
  }
  if (result.footInfo) {
    footInfo.textContent = result.footInfo;
  }
  if (result.armInfo) {
    armInfo.textContent = result.armInfo;
  }
  if (result.finalResult) {
    showResultPage(result.finalResult);
  }
}

function showResultPage(resultData) {
  footInfo.style.display = "none";
  armInfo.style.display = "none";
  info.style.display = "none";
  canvasElement.style.display = "none";

  const resultPage = document.getElementById("resultPage");
  resultPage.style.display = "block";

  document.getElementById("totalScore").textContent = resultData.totalScore.toFixed(1);
  document.getElementById("armScore").textContent = resultData.armScore.toFixed(1);
  document.getElementById("trunkScore").textContent = resultData.trunkScore.toFixed(1);
  document.getElementById("armFeedback").textContent = resultData.armFeedback;
  document.getElementById("trunkFeedback").textContent = resultData.trunkFeedback;

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

window.addEventListener("load", () => {
  canvasElement.width = 640;
  canvasElement.height = 480;
});
