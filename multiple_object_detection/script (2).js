// Set reference to key elements
const video = document.getElementById('webcam'); // video element, renders the video stream of webcam
const liveView = document.getElementById('liveView'); // button and video div container
const demosSection = document.getElementById('demos'); // section element with id of demos
const enableWebcamButton = document.getElementById('webcamButton'); // reference to button
const confidenceThresholdSlider = document.getElementById('confidence-threshold-slider');
let confidenceThreshold = confidenceThresholdSlider.value / 100; // divide by 100 to get a value between 0 and 1

// listen for the input event on the confidence threshold slider
confidenceThresholdSlider.addEventListener('input', () => {
  confidenceThreshold = confidenceThresholdSlider.value / 100;
});

// Check if browser allows accessing the webcam stream via getUserMedia  
function getUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); // !! cast to boolean value
}

// Add an event listener so that the web camera can be enabled when the button is pushed.
// Once the button is pushed the method enableCam will be invoked
if (getUserMediaSupported()) {
  enableWebcamButton.addEventListener('click', enableCam);
} else {
  console.warn('getUserMedia() is not supported by your browser');
}

// Enable the live webcam view and start classification.
function enableCam(event) {
  // Only continue if the COCO-SSD has finished loading.
  if (!model) {
    return; // return if model is not loaded
  }

  // Hide the button once clicked.
  event.target.classList.add('removed');

  // getUsermedia parameters to force video but not audio.
  const constraints = {
    video: true // only want video stream
  };

  // Activate the webcam stream with asynchronous call, thus the use of then. Then we use an anonymous inline function takes stream as argument
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    video.srcObject = stream;
    video.addEventListener('loadeddata', predictWebcam); // Register method predictWebcam
  });
}

// Before we can use COCO-SSD class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment 
// to get everything needed to run.
// Note: cocoSsd is an external object loaded from our index.html
cocoSsd.load().then(function (loadedModel) {
  model = loadedModel;
  // Show demo section now model is ready to use.
  demosSection.classList.remove('invisible');
});

const imageWidth = 224;
const imageHeight = 224;
const numClasses = 5;
const learningRate = 0.0001;
const numEpochs = 10;
const batchSize = 32;

async function loadTrainingData() {
}

async function trainModel() {
  const [trainingData, trainingLabels] = await loadTrainingData();

  // Load the base model
  const baseModel = await tf.loadLayersModel('https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/feature_vector/4', { fromTFHub: true });

  // Freeze the layers in the base model
  for (let layer of baseModel.layers) {
    layer.trainable = false;
  }

  // Add new layers on top of the base model
  const newLayers = tf.sequential();
  newLayers.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [baseModel.output.shape[1]] }));
  newLayers.add(tf.layers.dropout({ rate: 0.5 }));
  newLayers.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));

  // Combine the base model and new layers
  const model = tf.sequential();
  model.add(baseModel);
  model.add(newLayers);

  // Train the model using your own dataset
  const optimizer = tf.train.adam(learningRate);
  model.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  await model.fit(trainingData, trainingLabels, { epochs: numEpochs, batchSize: batchSize });

  return model;
}

////////////////////////////////////////////////
// Prediction - Classifying a frame from the webcam
//
// 1) A frame is passed to the model
// 2)
////////////////////////////////////////////////

var children = [];  // will hold all the html elements that will be drawn to the screen to highlight the objects found
const objectTimers = {};

function startObjectTimer(predictions, objectTimers) {
  // Check if timer exists for the object, and create one if it doesn't
  if (!objectTimers.hasOwnProperty(predictions.class)) {
    objectTimers[predictions.class] = { timer: null, time: 0 };
  }

  // Reset timer if object is still present
  if (objectTimers[predictions.class].timer) {
    clearTimeout(objectTimers[predictions.class].timer);
  }

  // Start timer for object
  objectTimers[predictions.class].timer = setTimeout(() => {
    // Object has been present for more than 2 minutes
    alert(predictions.class + " has been present for more than 2!");
    objectTimers[predictions.class].time = 0;
    console.log(predictions.class + " has been present for more than 2!");
  }, 120000);

  // Increment time object has been present
  objectTimers[predictions.class].time += Date.now() - objectTimers[predictions.class].time;
}      

// Now lets loop through predictions and draw the bounding boxes to the live view if
// they have a high confidence score.
function detectCollision(rect1, rect2) {
if (rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y) {
  // collision detected
  return true;
}
return false;
}

function checkCollisions(objects) {
if (objects.length > 1) {
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) { // start from i + 1
      if (detectCollision(objects[i].boundingBox, objects[j].boundingBox)) {
        // collision detected, do something here (e.g. trigger an alert)
        alert("Collision detected between " + objects[i].name + " and " + objects[j].name);
        console.log("Collision detected between " + objects[i].name + " and " + objects[j].name);
      }
    }
  }
}
}

// Animation Loop
function predictWebcam() {
  // Classify a frame in the video stream
  model.detect(video).then(function (predictions) {        // *** performs machine learning inference, and returns some results  
    // Remove any highlighting we did previous frame.
    for (let i = 0; i < children.length; i++) {            // Clear page of previous draw elements, before drawing any new ones
      liveView.removeChild(children[i]);
    }
    children.splice(0);                                    // Delete the array contents
    
    for (let n = 0; n < predictions.length; n++) {
      // If we are over confidenceThreshold sure we are sure we classified it right, draw it!
      if (predictions[n].score > confidenceThreshold) {
        const p = document.createElement('p');                      // Create a new paragraph element in memory
        p.innerText = predictions[n].class  + ' - with '            // Set paragraph inner text, class is the object (cat, dog, etc.)
            + Math.round(parseFloat(predictions[n].score) * 100)    // prediction score
            + '% confidence.';
        p.style = 'margin-left: ' + predictions[n].bbox[0] + 'px; margin-top: '
            + (predictions[n].bbox[1] - 10) + 'px; width: '              // Bbox array of 4 elements, (x1,y1), width, height
            + (predictions[n].bbox[2] - 10) + 'px; top: 0; left: 0;';

        const highlighter = document.createElement('div');         // div element 
        highlighter.setAttribute('class', 'highlighter');          // with semi-transparent background, and white border
        highlighter.style = 'left: ' + predictions[n].bbox[0] + 'px; top: '
            + predictions[n].bbox[1] + 'px; width: ' 
            + predictions[n].bbox[2] + 'px; height: '
            + predictions[n].bbox[3] + 'px;';

        liveView.appendChild(highlighter);                        // append div to the liveView container to add it to the html page and make it visible
        liveView.appendChild(p);                                  // append paragraph to the live View container to add it to the html page and make it visible
        children.push(highlighter);                               // add to children array for quick referrence for deletion   
        children.push(p);                                         // add to children array for quick referrence for deletion
      }
    }
    
    model.detect(video).then(function (predictions) {
      const objects = predictions.map(function (prediction) {
        return {
          name: prediction.class,
          boundingBox: {
            x: prediction.bbox[0],
            y: prediction.bbox[1],
            width: prediction.bbox[2],
            height: prediction.bbox[3]
          }
        }
      });
      window.requestAnimationFrame(predictWebcam);
      checkCollisions(objects);
      startObjectTimer(predictions, objectTimers);
      
      // ...
    });    
    
    // Call this function again to keep predicting when the browser is ready.
  });
  
}

