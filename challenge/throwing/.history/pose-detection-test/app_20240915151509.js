const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const info = document.getElementById('info');
const footInfo = document.getElementById('footInfo');
const armInfo = document.getElementById('armInfo');

let ws;

startButton.addEventListener('click', startDetection);

function startDetection() {
  startButton.style.display = 'none';
  info.textContent = '正在初始化...';

  initWebSocket();
  startCamera();
}

function initWebSocket() {
  ws = new WebSocket('ws://localhost:3000');
  ws.onopen = () => console.log('WebSocket连接已建立');
  ws.onmessage = handleServerMessage;
  ws.onerror = (error) => console.error('WebSocket错误:', error);
  ws.onclose = () => console.log('WebSocket连接已关闭');
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.play();
      sendFrames();
    })
    .catch(error => {
      console.error('无法访问摄像头:', error);
      info.textContent = '无法访问摄像头，请检查权限设置。';
    });
}

function sendFrames() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;
  const tempCtx = tempCanvas.getContext('2d');

  function captureAndSendFrame() {
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const imageData = tempCanvas.toDataURL('image/jpeg', 0.8);
    ws.send(JSON.stringify({ type: 'frame', image: imageData }));
  }

  setInterval(captureAndSendFrame, 100); // 每100ms发送一帧
}

function handleServerMessage(event) {
  const result = JSON.parse(event.data);
  if (result.message) info.textContent = result.message;
  if (result.footInfo) footInfo.textContent = result.footInfo;
  if (result.armInfo) armInfo.textContent = result.armInfo;
  if (result.finalResult) showResultPage(result.finalResult);
  if (result.image) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = result.image;
  }
}

function showResultPage(finalResult) {
  // 显示最终结果的代码
}
