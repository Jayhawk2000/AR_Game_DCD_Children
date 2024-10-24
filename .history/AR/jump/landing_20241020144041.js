let video, canvas, ctx;
let pose, camera;
let isDetectionStarted = false;
let landingDetected = false;

// Three.js variables
let scene, threeCamera, renderer, model;
let currentTime, startTime, endTime, slowFactor;

function initializeElements() {
  video = document.getElementById('video3');
  canvas = document.getElementById('output_canvas');
  canvas.width = video.width;
  canvas.height = video.height;
  ctx = canvas.getContext('2d');
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
  threeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("threejs_canvas"), alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  threeCamera.position.z = 5;

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(2, 2, 5);
  scene.add(light);

  startTime = 2.4;
  endTime = 4;
  currentTime = startTime;
  slowFactor = 0.5;

  loadModel();
}

function loadModel() {
  const loader = new THREE.FBXLoader();
  loader.load(
    "ForwardJump.fbx",
    function (object) {
      model = object;
      model.scale.set(0.04, 0.04, 0.04);
      model.position.set(-7, -4, -7);
      const degreesToRotate = 20;
      const radiansToRotate = degreesToRotate * (Math.PI / 180);
      model.rotation.y = radiansToRotate;
      scene.add(model);

      const loadingText = document.getElementById("loading-text");
      loadingText.style.display = "none";

      animate();
    },
    function (xhr) {
      const loadingText = document.getElementById("loading-text");
      const percentLoaded = Math.round((xhr.loaded / xhr.total) * 100);
      loadingText.textContent = `Loading model... ${percentLoaded}%`;
    },
    function (error) {
      console.error("An error occurred while loading the model:", error);
    }
  );
}

function animate() {
  requestAnimationFrame(animate);

  if (model && model.mixer) {
    const delta = clock.getDelta();
    model.mixer.update(delta * slowFactor);

    currentTime += delta * slowFactor;
    if (currentTime > endTime) {
      currentTime = startTime;
      model.mixer.setTime(startTime);
    }
  }

  renderer.render(scene, threeCamera);
}

async function startDetection() {
  await camera.start();
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
