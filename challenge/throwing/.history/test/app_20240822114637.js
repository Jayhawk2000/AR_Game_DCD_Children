let scene, camera, renderer, sphere;

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // 创建一个简单的球体
  const geometry = new THREE.SphereGeometry(0.1, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(0, 0, -0.5); // 将球体放置在摄像机前方
  scene.add(sphere);

  // 添加光源
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // 创建AR按钮
  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ["hit-test"] })
  );

  renderer.xr.addEventListener("sessionstart", onSessionStart);
  renderer.xr.addEventListener("sessionend", onSessionEnd);

  renderer.setAnimationLoop(render);
}

function onSessionStart() {
  console.log("AR session started");
}

function onSessionEnd() {
  console.log("AR session ended");
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (session && referenceSpace) {
      // 实现hit-test逻辑来放置球体
      session.requestHitTestSource({ space: referenceSpace }).then((source) => {
        const hitTestResults = frame.getHitTestResults(source);
        if (hitTestResults.length) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(referenceSpace);
          sphere.position.set(
            pose.transform.position.x,
            pose.transform.position.y,
            pose.transform.position.z
          );
          sphere.visible = true;
        }
      });
    }
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize, false);

// 检查WebXR支持
if ("xr" in navigator) {
  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    if (supported) {
      init();
    } else {
      console.log("WebXR AR not supported");
      document.body.appendChild(
        document.createTextNode("WebXR AR not supported")
      );
    }
  });
} else {
  console.log("WebXR not supported");
  document.body.appendChild(document.createTextNode("WebXR not supported"));
}
