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
      const imageData = JSON.parse(message).image;
      const result = await poseDetection.detectPose(imageData);
      ws.send(JSON.stringify(result));
    } catch (error) {
      console.error('姿势检测错误:', error);
      ws.send(JSON.stringify({ error: '姿势检测失败' }));
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