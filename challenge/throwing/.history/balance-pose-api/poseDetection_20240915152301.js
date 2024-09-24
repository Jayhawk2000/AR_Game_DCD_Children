const tf = require('@tensorflow/tfjs-node');
const posenet = require('@tensorflow-models/posenet');
const { createCanvas, loadImage } = require('canvas');

let net;

async function loadModel() {
  net = await posenet.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    inputResolution: { width: 640, height: 480 },
    multiplier: 0.75
  });
  console.log('PoseNet模型已加载');
}

loadModel();

async function processFrame(imageData) {
  try {
    const image = await loadImage(imageData);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const input = tf.browser.fromPixels(canvas);
    const poses = await net.estimatePoses(input, {
      flipHorizontal: false,
      decodingMethod: 'single-person',
      scoreThreshold: 0.6,
      nmsRadius: 20
    });

    input.dispose();

    if (poses.length > 0) {
      const pose = poses[0].keypoints;
      const result = checkBalancePose(pose, image.width, image.height);
      
      // 绘制关键点和骨架
      drawKeypoints(ctx, pose);
      drawSkeleton(ctx, pose);
      
      const outputImageData = canvas.toDataURL('image/jpeg');
      
      return { ...result, image: outputImageData, keypoints: pose };
    } else {
      return { message: '未检测到姿势' };
    }
  } catch (error) {
    console.error('姿势检测错误:', error);
    return { error: '姿势检测失败: ' + error.message };
  }
}

// 其他函数（如 checkBalancePose, drawKeypoints, drawSkeleton）保持不变

module.exports = { processFrame };