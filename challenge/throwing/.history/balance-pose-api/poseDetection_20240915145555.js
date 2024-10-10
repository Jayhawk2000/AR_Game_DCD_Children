const tf = require('@tensorflow/tfjs-node');
const posenet = require('@tensorflow-models/posenet');
const { createCanvas, loadImage } = require('canvas');

let net;
const BALANCE_POSE_DURATION = 5000; // 5 seconds
let balancePoseStartTime = 0;
let initialPose = null;
let maxDisplacement = 0;

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

async function detectPose(imageData) {
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
      return checkBalancePose(pose, image.width, image.height);
    } else {
      return { message: '未检测到姿势' };
    }
  } catch (error) {
    console.error('姿势检测错误:', error);
    return { error: '姿势检测失败: ' + error.message };
  }
}

function checkBalancePose(landmarks, width, height) {
  // 实现与原始app.js中相同的检测逻辑
  // 返回包含所有必要信息的对象，如oneFootRaised, armRaised, balancePoseDetected等
}

// 实现其他必要的辅助函数，如calculateAngle, checkArmRaised等

module.exports = { detectPose };