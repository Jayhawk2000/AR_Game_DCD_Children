const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const poseDetection = require('./poseDetection');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('客户端已连接');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'frame') {
        const result = await poseDetection.processFrame(data.image);
        ws.send(JSON.stringify(result));
      }
    } catch (error) {
      console.error('处理错误:', error);
      ws.send(JSON.stringify({ error: '处理失败' }));
    }
  });

  ws.on('close', () => {
    console.log('客户端已断开连接');
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`平衡姿势检测API运行在 http://localhost:${port}`);
});