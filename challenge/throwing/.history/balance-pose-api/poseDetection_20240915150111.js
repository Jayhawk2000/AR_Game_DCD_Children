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
      
      // 将canvas转换为base64图像
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

function checkBalancePose(landmarks, width, height) {
  const leftShoulder = landmarks.find(p => p.part === 'leftShoulder');
  const rightShoulder = landmarks.find(p => p.part === 'rightShoulder');
  const leftElbow = landmarks.find(p => p.part === 'leftElbow');
  const rightElbow = landmarks.find(p => p.part === 'rightElbow');
  const leftWrist = landmarks.find(p => p.part === 'leftWrist');
  const rightWrist = landmarks.find(p => p.part === 'rightWrist');
  const leftAnkle = landmarks.find(p => p.part === 'leftAnkle');
  const rightAnkle = landmarks.find(p => p.part === 'rightAnkle');

  const oneFootRaised = Math.abs(leftAnkle.position.y - rightAnkle.position.y) > height * 0.05;
  const leftArmStatus = checkArmRaised(leftShoulder, leftElbow, leftWrist);
  const rightArmStatus = checkArmRaised(rightShoulder, rightElbow, rightWrist);

  const currentTime = Date.now();

  if (oneFootRaised && (leftArmStatus.status === 'raised' || rightArmStatus.status === 'raised')) {
    if (!initialPose) {
      initialPose = {
        nose: landmarks.find(p => p.part === 'nose'),
        leftShoulder,
        rightShoulder,
        leftHip: landmarks.find(p => p.part === 'leftHip'),
        rightHip: landmarks.find(p => p.part === 'rightHip'),
      };
      balancePoseStartTime = currentTime;
      maxDisplacement = 0;
      return {
        message: '保持平衡姿势',
        footInfo: '很好！保持脚抬起。',
        armInfo: '手臂抬起，保持姿势！'
      };
    } else {
      updateMaxDisplacement(landmarks);

      if (currentTime - balancePoseStartTime >= BALANCE_POSE_DURATION) {
module.exports = { processFrame };