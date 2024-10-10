const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const poseDetection = require('./poseDetection');

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));

app.post('/detect-pose', async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: '缺少图像数据' });
    }

    const image = await loadImage(imageData);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const result = await poseDetection.detectPose(canvas);
    res.json(result);
  } catch (error) {
    console.error('姿势检测错误:', error);
    res.status(500).json({ error: '姿势检测失败' });
  }
});

app.listen(port, () => {
  console.log(`平衡姿势检测API运行在 http://localhost:${port}`);
});