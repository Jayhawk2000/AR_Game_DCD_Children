const tf = require("@tensorflow/tfjs-node");
const posenet = require("@tensorflow-models/posenet");
const { createCanvas, loadImage } = require("canvas");

let net;
const BALANCE_POSE_DURATION = 5000; // 5 seconds
let balancePoseStartTime = 0;
let initialPose = null;
let maxDisplacement = 0;

async function loadModel() {
  net = await posenet.load({
    architecture: "MobileNetV1",
    outputStride: 16,
    inputResolution: { width: 640, height: 480 },
    multiplier: 0.75,
  });
  console.log("PoseNet模型已加载");
}

loadModel();

async function processFrame(imageData) {
  try {
    const image = await loadImage(imageData);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const input = tf.browser.fromPixels(canvas);
    const poses = await net.estimatePoses(input, {
      flipHorizontal: false,
      decodingMethod: "single-person",
      scoreThreshold: 0.6,
      nmsRadius: 20,
    });

    input.dispose();

    if (poses.length > 0) {
      const pose = poses[0].keypoints;
      const result = checkBalancePose(pose, image.width, image.height);

      drawKeypoints(ctx, pose);
      drawSkeleton(ctx, pose);

      const outputImageData = canvas.toDataURL("image/jpeg");

      return { ...result, image: outputImageData, keypoints: pose };
    } else {
      return { message: "未检测到姿势" };
    }
  } catch (error) {
    console.error("姿势检测错误:", error);
    return { error: "姿势检测失败: " + error.message };
  }
}

function checkBalancePose(landmarks, width, height) {
  const leftShoulder = landmarks.find((p) => p.part === "leftShoulder");
  const rightShoulder = landmarks.find((p) => p.part === "rightShoulder");
  const leftElbow = landmarks.find((p) => p.part === "leftElbow");
  const rightElbow = landmarks.find((p) => p.part === "rightElbow");
  const leftWrist = landmarks.find((p) => p.part === "leftWrist");
  const rightWrist = landmarks.find((p) => p.part === "rightWrist");
  const leftAnkle = landmarks.find((p) => p.part === "leftAnkle");
  const rightAnkle = landmarks.find((p) => p.part === "rightAnkle");

  const oneFootRaised =
    Math.abs(leftAnkle.position.y - rightAnkle.position.y) > 0.05 * height;
  const leftArmStatus = checkArmRaised(leftShoulder, leftElbow, leftWrist);
  const rightArmStatus = checkArmRaised(rightShoulder, rightElbow, rightWrist);

  let message = "";
  let footInfo = "";
  let armInfo = "";

  if (oneFootRaised) {
    footInfo = "很好！保持脚抬起。";
    if (leftArmStatus && rightArmStatus) {
      armInfo = "手臂抬起，保持姿势！";
      message = "保持平衡姿势";
      if (!initialPose) {
        initialPose = landmarks;
        balancePoseStartTime = Date.now();
        maxDisplacement = 0;
      } else {
        const displacement = calculateDisplacement(initialPose, landmarks);
        maxDisplacement = Math.max(maxDisplacement, displacement);
        if (Date.now() - balancePoseStartTime >= BALANCE_POSE_DURATION) {
          const trunkScore = calculateTrunkScore(maxDisplacement);
          const armScore = (leftArmStatus + rightArmStatus) * 5;
          const totalScore = (trunkScore + armScore) / 2;
          message = "平衡姿势完成！";
          const finalResult = {
            totalScore,
            armScore,
            trunkScore,
            armFeedback: getArmFeedback(armScore),
            trunkFeedback: getTrunkFeedback(trunkScore),
          };
          initialPose = null;
          balancePoseStartTime = 0;
          maxDisplacement = 0;
          return { message, footInfo, armInfo, finalResult };
        }
      }
    } else {
      armInfo = "请将双臂抬起至肩部高度";
      initialPose = null;
      balancePoseStartTime = 0;
    }
  } else {
    footInfo = "请抬起一只脚";
    armInfo = "请将双臂抬起至肩部高度";
    initialPose = null;
    balancePoseStartTime = 0;
  }

  return { message, footInfo, armInfo };
}

function checkArmRaised(shoulder, elbow, wrist) {
  return (
    elbow.position.y < shoulder.position.y &&
    wrist.position.y < elbow.position.y
  );
}

function calculateDisplacement(initialPose, currentPose) {
  const displacement = initialPose.reduce((sum, point, index) => {
    const dx = point.position.x - currentPose[index].position.x;
    const dy = point.position.y - currentPose[index].position.y;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);
  return displacement / initialPose.length;
}

function calculateTrunkScore(maxDisplacement) {
  if (maxDisplacement < 0.02) return 10;
  if (maxDisplacement < 0.04) return 8;
  if (maxDisplacement < 0.06) return 6;
  if (maxDisplacement < 0.08) return 4;
  if (maxDisplacement < 0.1) return 2;
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
  keypoints.forEach((keypoint) => {
    if (keypoint.score > 0.2) {
      const { x, y } = keypoint.position;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });
}

function drawSkeleton(ctx, keypoints) {
  const connections = [
    ["leftShoulder", "rightShoulder"],
    ["leftShoulder", "leftElbow"],
    ["leftElbow", "leftWrist"],
    ["rightShoulder", "rightElbow"],
    ["rightElbow", "rightWrist"],
    ["leftShoulder", "leftHip"],
    ["rightShoulder", "rightHip"],
    ["leftHip", "rightHip"],
    ["leftHip", "leftKnee"],
    ["leftKnee", "leftAnkle"],
    ["rightHip", "rightKnee"],
    ["rightKnee", "rightAnkle"],
  ];

  connections.forEach(([startPoint, endPoint]) => {
    const start = keypoints.find((kp) => kp.part === startPoint);
    const end = keypoints.find((kp) => kp.part === endPoint);

    if (start && end && start.score > 0.2 && end.score > 0.2) {
      ctx.beginPath();
      ctx.moveTo(start.position.x, start.position.y);
      ctx.lineTo(end.position.x, end.position.y);
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

module.exports = { processFrame };
