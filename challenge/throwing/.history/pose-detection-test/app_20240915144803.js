const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultDiv = document.getElementById("result");
const startButton = document.getElementById("startButton");

let isRunning = false;
let ws;

startButton.addEventListener("click", startDetection);

function startDetection() {
  if (isRunning) return;
  isRunning = true;
  startButton.disabled = true;
  startButton.textContent = "检测中...";

  ws = new WebSocket("ws://localhost:3000");

  ws.onopen = () => {
    console.log("WebSocket连接已建立");
    setupCamera();
  };

  ws.onerror = (error) => {
    console.error("WebSocket错误:", error);
    stopDetection();
  };

  ws.onclose = () => {
    console.log("WebSocket连接已关闭");
    stopDetection();
  };

  ws.onmessage = (event) => {
    console.log("收到消息:", event.data);
    const result = JSON.parse(event.data);
    displayResult(result);
  };
}

function stopDetection() {
  isRunning = false;
  startButton.disabled = false;
  startButton.textContent = "开始检测";
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  if (ws) {
    ws.close();
  }
  resultDiv.textContent = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function setupCamera() {
  console.log("开始设置摄像头");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      console.log("视频元数据已加载");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      detectPose();
    };
  } catch (error) {
    console.error("设置摄像头时出错:", error);
    stopDetection();
  }
}

function detectPose() {
  if (!isRunning) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = canvas.toDataURL("image/jpeg");
  ws.send(JSON.stringify({ image: imageData }));
  requestAnimationFrame(detectPose);
}

function displayResult(result) {
  console.log("显示结果:", result);
  if (result.error) {
    resultDiv.textContent = result.error;
  } else if (result.message) {
    resultDiv.textContent = result.message;
  } else {
    resultDiv.innerHTML = `
            手臂得分: ${result.armScore.toFixed(2)}<br>
            躯干得分: ${result.trunkScore.toFixed(2)}<br>
            总分: ${result.totalScore.toFixed(2)}<br>
            手臂反馈: ${result.armFeedback}<br>
            躯干反馈: ${result.trunkFeedback}
        `;
  }
}
