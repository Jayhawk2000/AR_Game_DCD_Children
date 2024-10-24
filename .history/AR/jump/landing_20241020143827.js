let video, canvas, ctx, threeCanvas, scene, camera, renderer, model;
let pose, mediapipeCamera;
let isDetectionStarted = false;
let landingDetected = false;
let initialFootPosition = null;

function initializeElements() {
  video = document.getElementById('video3');
  canvas = document.getElementById('output_canvas');
  canvas.width = video.width;
  canvas.height = video.height;
  ctx = canvas.getContext('2d');
  
  threeCanvas = document.getElementById('three-canvas');
}

function initializeCamera() {
  mediapipeCamera = new Camera(video, {
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
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
    
    checkLanding(results.poseLandmarks);
  }

  ctx.restore();
}

function checkLanding(landmarks) {
  const instructionText = document.getElementById('instruction-text');
  
  const isFeetApart = checkFeetApart(landmarks);
  const isKneesBent = checkKneesBent(landmarks);

  if (isFeetApart && isKneesBent) {
    if (!landingDetected) {
      landingDetected = true;
      instructionText.textContent = "Great! You've completed the correct landing motion!";
    }
  } else {
    landingDetected = false;
    if (!isFeetApart) {
      instructionText.textContent = "Keep your feet apart when landing";
    } else if (!isKneesBent) {
      instructionText.textContent = "Bend your knees slightly when landing";
    }
  }
}

function checkFeetApart(landmarks) {
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const distance = Math.abs(leftAnkle.x - rightAnkle.x);
  return distance > 0.1;
}

function checkKneesBent(landmarks) {
  const leftHip = landmarks[23];
  const leftKnee = landmarks[25];
  const leftAnkle = landmarks[27];
  const rightHip = landmarks[24];
  const rightKnee = landmarks[26];
  const rightAnkle = landmarks[28];

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  return leftKneeAngle < 170 && rightKneeAngle < 170;
}

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function initializeThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(light);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 1, 0);
  scene.add(directionalLight);

  camera.position.z = 5;

  loadModel();
  animate();
}

function loadModel() {
  const loader = new THREE.FBXLoader();
  loader.load('path/to/your/model.fbx', (fbx) => {
    model = fbx;
    scene.add(model);
    document.getElementById('loading-text').style.display = 'none';
  }, (xhr) => {
    document.getElementById('loading-text').textContent = `Loading model... ${Math.round(xhr.loaded / xhr.total * 100)}%`;
  }, (error) => {
    console.error('An error occurred while loading the model:', error);
  });
}

function animate() {
  requestAnimationFrame(animate);
  if (model) {
    model.rotation.y += 0.01;
  }
  renderer.render(scene, camera);
}

async function startDetection() {
  await mediapipeCamera.start();
  isDetectionStarted = true;
}

function init() {
  initializeElements();
  initializeCamera();
  initializePose();
  initializeThreeJS();
  startDetection();
}

document.addEventListener('DOMContentLoaded', init);
