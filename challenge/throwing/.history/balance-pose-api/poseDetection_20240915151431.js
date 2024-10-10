const tf = require('@tensorflow/tfjs-node');
const pose = require('@mediapipe/pose');
const { createCanvas, loadImage } = require('canvas');

let poseSolution;
const BALANCE_POSE_DURATION = 5000; // 5 seconds
let balancePoseStartTime = 0;
let initialPose = null;
let maxDisplacement = 0;

async function initializePoseSolution() {
  poseSolution = new pose.Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
  });

  poseSolution.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  await poseSolution.initialize();
}

initializePoseSolution();

async function processFrame(imageData) {
  try {
    const image = await loadImage(imageData);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageDataArray = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const results = await runPoseDetection(imageDataArray, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      const result = checkBalancePose(results.poseLandmarks, canvas.width, canvas.height);
      
      // 绘制关键点和骨架
      drawResults(ctx, results);
      
      const outputImageData = canvas.toDataURL('image/jpeg');
      
      return { ...result, image: outputImageData, keypoints: results.poseLandmarks };
    } else {
      return { message: '未检测到姿势' };
    }
  } catch (error) {
    console.error('姿势检测错误:', error);
    return { error: '姿势检测失败: ' + error.message };
  }
}

async function runPoseDetection(imageData, width, height) {
  return new Promise((resolve, reject) => {
    poseSolution.onResults((results) => {
      resolve(results);
    });

    poseSolution.send({image: {
      data: imageData,
      width: width,
      height: height,
    }});
  });
}

function checkBalancePose(landmarks, width, height) {
  // 这个函数的逻辑基本保持不变，只需要调整一下关键点的访问方式
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const oneFootRaised = Math.abs(leftAnkle.y - rightAnkle.y) > height * 0.05;
  const leftArmStatus = checkArmRaised(leftShoulder, leftElbow, leftWrist);
  const rightArmStatus = checkArmRaised(rightShoulder, rightElbow, rightWrist);

  const currentTime = Date.now();

  if (oneFootRaised && (leftArmStatus.status === 'raised' || rightArmStatus.status === 'raised')) {
    if (!initialPose) {
      initialPose = {
        nose: landmarks[0],
        leftShoulder,
        rightShoulder,
        leftHip: landmarks[23],
        rightHip: landmarks[24],
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
  const heightDiff = shoulder.y - wrist.y;
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