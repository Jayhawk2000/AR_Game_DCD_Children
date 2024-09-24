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
        const armScore = Math.max(leftArmStatus.score, rightArmStatus.score);
        const trunkStabilityScore = calculateTrunkStability();
        const totalScore = (armScore + trunkStabilityScore) / 2;
        return {
          finalResult: {
            armScore: armScore,
            trunkScore: trunkStabilityScore,
            totalScore: totalScore,
            armFeedback: getArmFeedback(armScore),
            trunkFeedback: getTrunkFeedback(trunkStabilityScore),
          }
        };
      } else {
        const remainingTime = Math.ceil((BALANCE_POSE_DURATION - (currentTime - balancePoseStartTime)) / 1000);
        return { message: `保持稳定还需 ${remainingTime} 秒！` };
      }
    }
  } else {
    initialPose = null;
    maxDisplacement = 0;
    return {
      footInfo: oneFootRaised ? '' : '抬高一只脚。',
      armInfo: (leftArmStatus.status === 'raised' || rightArmStatus.status === 'raised') ? '' : '抬起至少一只手臂。'
    };
  }
}

function checkArmRaised(shoulder, elbow, wrist) {
  const heightScore = getArmHeightScore(shoulder, wrist);
  const extensionScore = getArmExtensionScore(shoulder, elbow, wrist);
  const score = (heightScore + extensionScore) / 2;
  return { status: score > 0 ? 'raised' : 'lowered', score: score };
}

function getArmHeightScore(shoulder, wrist) {
  const heightDiff = shoulder.position.y - wrist.position.y;
  if (heightDiff >= 0) return 10;
  if (heightDiff > -0.1) return 8;
  if (heightDiff > -0.2) return 6;
  return 4;
}

function getArmExtensionScore(shoulder, elbow, wrist) {
  const angle = calculateAngle(shoulder.position, elbow.position, wrist.position);
  if (angle >= 170) return 10;
  if (angle >= 150) return 8;
  if (angle >= 120) return 6;
  return 4;
}

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function updateMaxDisplacement(landmarks) {
  const calculateDisplacement = (initial, current) => {
    const dx = initial.position.x - current.position.x;
    const dy = initial.position.y - current.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const displacements = [
    calculateDisplacement(initialPose.nose, landmarks.find(p => p.part === 'nose')),
    calculateDisplacement(initialPose.leftShoulder, landmarks.find(p => p.part === 'leftShoulder')),
    calculateDisplacement(initialPose.rightShoulder, landmarks.find(p => p.part === 'rightShoulder')),
    calculateDisplacement(initialPose.leftHip, landmarks.find(p => p.part === 'leftHip')),
    calculateDisplacement(initialPose.rightHip, landmarks.find(p => p.part === 'rightHip')),
  ];

  const currentMaxDisplacement = Math.max(...displacements);
  maxDisplacement = Math.max(maxDisplacement, currentMaxDisplacement);
}

function calculateTrunkStability() {
  if (maxDisplacement < 0.01) return 10;
  if (maxDisplacement < 0.02) return 9;
  if (maxDisplacement < 0.03) return 8;
  if (maxDisplacement < 0.04) return 7;
  if (maxDisplacement < 0.05) return 6;
  if (maxDisplacement < 0.06) return 5;
  if (maxDisplacement < 0.08) return 4;
  if (maxDisplacement < 0.1) return 3;
  if (maxDisplacement < 0.15) return 2;
  if (maxDisplacement < 0.2) return 1;
  return 0;
}

function getArmFeedback(score) {
  if (score >= 9) return "手臂位置很好！";
  if (score >= 7) return "手臂位置不错。试着再抬高一点，并伸直手臂。";
  if (score >= 5) return "手臂位置一般。注意将手臂抬到肩膀高度并完全伸直。";
  return "继续努力，将手臂抬得更高并伸直。";
}

function getTrunkFeedback(score) {
  if (score === 10) return "完美的稳定性！你保持得非常稳定。";
  if (score >= 8) return "很好的稳定性。只有很小的移动。";
  if (score >= 6) return "不错的稳定性。有一些轻微的移动，但整体保持得很好。";
  if (score >= 4) return "稳定性一般。试着减少身体的移动。";
  if (score >= 2) return "需要改进。专注于保持身体尽可能静止。";
  return "检测到明显的移动。练习保持姿势稳定。";
}

function drawKeypoints(ctx, keypoints) {
  ctx.fillStyle = 'red';
  keypoints.forEach(keypoint => {
    if (keypoint.score > 0.2) {
      const { x, y } = keypoint.position;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

function drawSkeleton(ctx, keypoints) {
  const connections = [
    ['leftShoulder', 'rightShoulder'],
    ['leftShoulder', 'leftElbow'],
    ['leftElbow', 'leftWrist'],
    ['rightShoulder', 'rightElbow'],
    ['rightElbow', 'rightWrist'],
    ['leftShoulder', 'leftHip'],
    ['rightShoulder', 'rightHip'],
    ['leftHip', 'rightHip'],
    ['leftHip', 'leftKnee'],
    ['leftKnee', 'leftAnkle'],
    ['rightHip', 'rightKnee'],
    ['rightKnee', 'rightAnkle']
  ];

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;

  connections.forEach(([startPoint, endPoint]) => {
    const start = keypoints.find(kp => kp.part === startPoint);
    const end = keypoints.find(kp => kp.part === endPoint);

    if (start && end && start.score > 0.2 && end.score > 0.2) {
      ctx.beginPath();
      ctx.moveTo(start.position.x, start.position.y);
      ctx.lineTo(end.position.x, end.position.y);
      ctx.stroke();
    }
  });
}

module.exports = { processFrame };