const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const resultDiv = document.getElementById('result');

const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
    console.log('WebSocket连接已建立');
    setupCamera();
};

ws.onmessage = (event) => {
    const result = JSON.parse(event.data);
    displayResult(result);
};

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        detectPose();
    };
}

function detectPose() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg');
    ws.send(JSON.stringify({ image: imageData }));
    requestAnimationFrame(detectPose);
}

function displayResult(result) {
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