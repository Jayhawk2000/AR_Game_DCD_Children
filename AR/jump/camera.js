// camera.js
export function startCamera(videoElementId) {
    const videoElement = document.getElementById(videoElementId);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                videoElement.srcObject = stream;
            })
            .catch(err => {
                console.error("Error accessing the camera: ", err);
            });
    } else {
        alert("Your browser does not support accessing the camera.");
    }
}
