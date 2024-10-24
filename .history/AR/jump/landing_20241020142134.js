let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let jumpPhase = 'preparation';
let initialFootPosition = null;
let jumpStartTime = 0;
let jumpCompleted = false;
let isModelLoaded = false;

function initializeElements() {
  video = document.getElementById('video3');
  canvas = document.createElement('canvas');
  canvas.width = video.width;
  canvas.height = video.height;
  ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
}

function initializeCamera() {
  camera = new Camera(video, {
    onFrame: async () => {
      if (pose && isDetectionStarted) {
        await pose.send({image: video});
      }
    },
    width: 1280,
    height: 720
  });
}

function initializePose() {
  pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
  });
  
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(onResults);

  pose.initialize().then(() => {
    isModelLoaded = true;
    document.getElementById('loading-text').style.display = 'none';
    startDetection();
  });
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
    
    if (!poseDetector.isInStartingPosition) {
      if (poseDetector.checkStartingPosition(results.poseLandmarks)) {
        document.getElementById('instruction-text').textContent = "Great! Now jump!";
      } else {
        document.getElementById('instruction-text').textContent = "Bend your knees and prepare to jump.";
      }
    } else if (!poseDetector.jumpCompleted) {
      const jumpStatus = poseDetector.checkJumpingPose(results.poseLandmarks);
      if (jumpStatus === "Jump started") {
        document.getElementById('instruction-text').textContent = "Good jump! Now land softly.";
      } else if (jumpStatus === "Jump completed") {
        document.getElementById('instruction-text').textContent = "Great job! You've completed the jump!";
      }
    }
  }

  ctx.restore();
}

class PoseDetector {
  constructor() {
    this.isInStartingPosition = false;
    this.jumpStarted = false;
    this.jumpCompleted = false;
    this.initialFootPosition = null;
    this.jumpStartTime = 0;
    this.minimumJumpHeight = 0.05;
  }

  checkStartingPosition(landmarks) {
    const isFeetSlightlyApart = this.checkFeetApart(landmarks);
    const isSlightlyBentKnees = this.checkBentKnees(landmarks);

    if (isFeetSlightlyApart && isSlightlyBentKnees) {
      this.isInStartingPosition = true;
      this.initialFootPosition = this.getFootPosition(landmarks);
      return true;
    }
    return false;
  }

  checkFeetApart(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const distance = Math.abs(leftAnkle.x - rightAnkle.x);
    return distance > 0.1 && distance < 0.3;
  }

  checkBentKnees(landmarks) {
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];

    const leftKneeAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle);

    return leftKneeAngle < 170 && rightKneeAngle < 170;
  }

  calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  }

  getFootPosition(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    return { left: leftAnkle, right: rightAnkle };
  }

  checkJumpingPose(landmarks) {
    const currentFootPosition = this.getFootPosition(landmarks);
    const jumpHeight = Math.min(
      this.initialFootPosition.left.y - currentFootPosition.left.y,
      this.initialFootPosition.right.y - currentFootPosition.right.y
    );

    if (jumpHeight > this.minimumJumpHeight && !this.jumpStarted) {
      this.jumpStarted = true;
      this.jumpStartTime = Date.now();
      return "Jump started";
    } else if (this.jumpStarted && !this.jumpCompleted) {
      if (Date.now() - this.jumpStartTime > 2000) {
        this.jumpCompleted = true;
        return "Jump completed";
      }
      return "Jump in progress";
    }
    return null;
  }
}

const poseDetector = new PoseDetector();

function init() {
  initializeElements();
  initializeCamera();
  initializePose();
}

async function startDetection() {
  await camera.start();
  isDetectionStarted = true;
  pose.send({image: video});
}

function updateLoadingProgress(progress) {
  document.getElementById('loading-text').textContent = `Loading model... ${Math.round(progress * 100)}%`;
}

document.addEventListener('DOMContentLoaded', init);
