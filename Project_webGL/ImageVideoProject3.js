//


//
var gl;
var program;
var canvas;
var aspect;

var textureId;  //for video
var videoId;    //for video

var copyVideo = false;   //for video
var grayScale = true;    //for video

var imageAspect;

var dimAndKernelWeight = vec3(1241.0, 639.0, 16.0);
var kernal = mat3();
var filter = "normal";
// var filter = "boxBlur";
// var filter = "triangleBlur";
// var filter = "sharpen";
// var filter = "sharpen2";
// var filter = "sharpen8";
// var filter = "edgeDetector";
// var filter = "unsharpen";
// var filter = "gausianBlur";
// var filter = "gausianBlur2";
// var filter = "sobelV";
// var filter = "sobelH";
// var filter = "emboss";
// var filter = "prewittV";
// var filter = "prewittH";

var left = -2;           // left limit of world coords
var right = 2;           // right limit of world coords
var bottom = -2;         // bottom limit of world coords
var topBound = 2;        // top limit of worlds coord
var near = -10;           // near clip plane
var far = 10;             // far clip plane

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" ); // Get HTML canvas

    gl = canvas.getContext('webgl2');                    // Get a WebGL 2.0 context
    if ( !gl ) { alert( "WebGL isn't available" ); }

    aspect = canvas.width / canvas.height;        // get the aspect ratio of the canvas
    left *= aspect;                                   // left limit of world coords
    right *= aspect;                                  // right limit of world coords

    //  Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" ); // Compile and link shaders to form a program
    gl.useProgram(program);                                              // Make this the active shaer program

    // Set up texture
    var image = document.getElementById("texImage"); //get the image from html file
    configureTexture2(image);

    imageAspect = image.width / image.height;

    dimAndKernelWeight[0] = image.width;
    dimAndKernelWeight[1] = image.height;

    // Vertices of two triangles in complex plane

    var vertices = [
        vec2(-2.0 * imageAspect,  2.0),
        vec2(-2.0 * imageAspect, -2.0),
        vec2( 2.0 * imageAspect, -2.0),
        vec2(-2.0 * imageAspect,  2.0),
        vec2( 2.0 * imageAspect,  2.0),
        vec2( 2.0 * imageAspect, -2.0)
    ];

    var texCoordsArray = [
        vec2(0.0, 1.0),
        vec2(0.0, 0.0),
        vec2(1.0, 0.0),
        vec2(0.0, 1.0),
        vec2(1.0, 1.0),
        vec2(1.0, 0.0)
    ];

    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );  // What part of html are we looking at?
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );               // Set background color of the viewport to black

    // Texture attribute VBO

    var tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoordsArray), gl.STATIC_DRAW);

    var vTexCoord = gl.getAttribLocation(program, "vTexCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vTexCoord);

    // Load the data into the GPU

    var bufferId = gl.createBuffer();                                    // Generate a VBO id
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );                          // Bind this VBO to be the active one
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW ); // Load the VBO with vertex data

    // Associate our shader variables with our data buffer

    var vPosition = gl.getAttribLocation( program, "vPosition" );        // Link js vPosition with "vertex shader attribute variable" - vPosition
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0 );        // Specify layout of VBO memory
    gl.enableVertexAttribArray(vPosition);                               // Enable this attribute

    textureId = initTexture(gl);                                   // For video
    videoId = setupVideo ('Ducks_H264_Videvo.mp4');                            // CALL VIDEO

    render();
};

var m = document.getElementById("mymenu");
m.addEventListener("click", function() {
    switch (m.selectedIndex) {
        case 0:
            dimAndKernelWeight[2] = 1.0;  filter = "normal";
            break;
        case 1:
            dimAndKernelWeight[2] = 1.0;  filter = "boxBlur";
            break;
        case 2:
            dimAndKernelWeight[2] = 1.0;  filter = "triangleBlur";
            break;
        case 3:
            dimAndKernelWeight[2] = 1.0;  filter = "sharpen";
            break;
        case 4:
            dimAndKernelWeight[2] = 1.0;  filter = "sharpen2";
            break;
        case 5:
            dimAndKernelWeight[2] = 1.0;  filter = "sharpen8";
            break;
        case 6:
            dimAndKernelWeight[2] = 1.0;  filter = "edgeDetector";
            break;
        case 7:
            dimAndKernelWeight[2] = 1.0;  filter = "unsharpen";
            break;
        case 8:
            dimAndKernelWeight[2] = 4.0;  filter = "gausianBlur";
            break;
        case 9:
            dimAndKernelWeight[2] = 16.0;  filter = "gausianBlur2";
            break;
        case 10:
            dimAndKernelWeight[2] = 1.0;  filter = "sobelV";
            break;
        case 11:
            dimAndKernelWeight[2] = 1.0;  filter = "sobelH";
            break;
        case 12:
            dimAndKernelWeight[2] = 1.0;  filter = "emboss";
            break;
        case 13:
            dimAndKernelWeight[2] = 1.0;  filter = "prewittV";
            break;
        case 14:
            dimAndKernelWeight[2] = 1.0;  filter = "prewittH";
            break;
    }
});

// Callback function for keydown events, rgeisters function dealWithKeyboard
window.addEventListener("keydown", dealWithKeyboard, false);

// Functions that gets called to parse keydown events
function dealWithKeyboard(e) {
    switch (e.keyCode) {
        case 33: // PageUp key , Zoom in
        {
            var range = (right - left);
            var delta = (range - range * 0.9) * 0.5;
            left += delta; right -= delta;
            range = topBound - bottom;
            delta = (range - range * 0.9) * 0.5;
            bottom += delta; topBound -= delta;
        }
            break;
        case 34: // PageDown key, zoom out
        {
            var range = (right - left);
            var delta = (range * 1.1 - range) * 0.5;
            left -= delta; right += delta;
            range = topBound - bottom;
            delta = (range * 1.1 - range) * 0.5;
            bottom -= delta; topBound += delta;
        }
            break;
        case 37: // left arrow pan left
        { left += -0.1; right += -0.1; }
            break;
        case 38: // up arrow pan up
        { bottom += 0.1; topBound += 0.1; }
            break;
        case 39: // right arrow pan right
        { left += 0.1; right += 0.1; }
            break;
        case 40: // down arrow pan down
        { bottom += -0.1; topBound += -0.1;}
            break;
    }
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);            // Clear viewport with gl.clearColor defined above

    if (copyVideo){
        updateTexture (gl , textureId , videoId);              // For video
    }

    var PMat;                                                  // js variable to hold projection matrix
    //console.log(left + " " + right);
    PMat = ortho(left, right, bottom, topBound, near, far);    // Call function to compute orthographic projection matrix

    var P_loc = gl.getUniformLocation(program, "P");           // Get Vertex shader memory location for P
    gl.uniformMatrix4fv(P_loc, false, flatten(PMat));          // Set uniform variable P on GPU

    // Get uniform locations
    // Set CPU-side variables for all of our shader variables

    // Define several convolution kernels
    var kernels = {
        normal: [
            0, 0, 0,
            0, 1, 0,
            0, 0, 0
        ],
        boxBlur: [
            0.111, 0.111, 0.111,
            0.111, 0.111, 0.111,
            0.111, 0.111, 0.111
        ],
        triangleBlur: [
            0.0625, 0.125, 0.0625,
            0.125,  0.25,  0.125,
            0.0625, 0.125, 0.0625
        ],
        sharpen: [
            0.0, -1.0, 0.0,
            -1.0, 5.0, -1.0,
            0.0, -1.0, 0.0
        ],
        sharpen2: [
            0.0, -2.0, 0.0,
            -2.0, 9.0, -2.0,
            0.0, -2.0, 0.0
        ],
        sharpen8: [
            0.0, -8.0, 0.0,
            -8.0, 33.0, -8.0,
            0.0, -8.0, 0.0
        ],
        sharpen16: [
            -1.0, -1.0, -1.0,
            -1.0, 16.0, -1.0,
            -1.0, -1.0, -1.0
        ],
        edgeDetector: [
            0.0, -1.0, 0.0,
            -1.0, 4.0, -1.0,
            0.0, -1.0, 0.0
        ],
        unsharpen: [
            -1.0, -1.0, -1.0,
            -1.0, 9.0, -1.0,
            -1.0, -1.0, -1.0
        ],
        gausianBlur: [
            0, 1, 0,
            1, 1, 1,
            0, 1, 0
        ],
        gausianBlur2: [
            1, 2, 1,
            2, 4, 2,
            1, 2, 1
        ],
        sobelV: [
            -1.0, 0.0, 1.0,
            -2.0, 0.0, 2.0,
            -1.0, 0.0, 1.0
        ],
        sobelH: [
            1.0, 2.0, 1.0,
            0.0, 0.0, 0.0,
            -1.0, -2.0, -1.0
        ],
        emboss: [
            1.0, 0.0, 0.0,
            0.0, 0.0, 0.0,
            0.0, 0.0, -1.0
        ],
        prewittV: [
            1.0, 0.0, -1.0,
            1.0, 0.0, -1.0,
            1.0, 0.0, -1.0
        ],
        prewittH: [
            1.0, 1.0, 1.0,
            0.0, 0.0, 0.0,
            -1.0, -1.0, -1.0

        ]
    };

    var kernelLocation = gl.getUniformLocation(program, "kernel[0]");
    gl.uniform1fv(kernelLocation, kernels[filter]);

    var dimAndKernelWeightLoc = gl.getUniformLocation(program, "dimAndKernelWeight");
    gl.uniform3fv(dimAndKernelWeightLoc, dimAndKernelWeight);

    gl.drawArrays(gl.TRIANGLES, 0, 6);         // Draw two triangles using the TRIANGLES primitive using 6 vertices
    requestAnimationFrame(render);                                  // swap buffers, continue render loop
}

function configureTexture2(image) {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    //    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
}

function initTexture (gl , url){
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D , texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL , true);

    // Because video has to be download over the internet
    // they might take a moment until it's ready so
    // put a single pixel in the texture so we can
    // use it immediately.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0 , 0 , 255 , 255]); // opaque blue
    gl.texImage2D(gl.TEXTURE_2D , level , internalFormat , width , height , border , srcFormat , srcType , pixel);

    // Turn off mips and set wrapping to clamp to edge so it
    // will work regardless of the dimensions of the video.
    gl.texParameteri(gl.TEXTURE_2D , gl.TEXTURE_WRAP_S , gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D , gl.TEXTURE_WRAP_T , gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D , gl.TEXTURE_MIN_FILTER , gl.LINEAR);

    return texture;
}

//
// copy the video texture
//
function updateTexture(gl , texture , video ){
    const level = 0;
    const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    gl.bindTexture(gl.TEXTURE_2D , texture);
    gl.texImage2D(gl.TEXTURE_2D , level , internalFormat , srcFormat , srcType , video);
}

function setupVideo(url){
    debugger
    const video = document.createElement('video');

    var playing = false;
    var timeupdate = false;

    video.autoplay = true;
    video.muted = true;
    video.loop = true;

    // Waiting for these 2 events ensures there is data in the video

    video.addEventListener ('playing', function (){
        playing = true;
        checkReady();
    }, true);

    video.addEventListener ('timeupdate', function (){
        timeupdate = true;
        checkReady();
    }, true);

    video.src = url;
    video.play();

    function checkReady (){
        if (playing && timeupdate) {
            copyVideo = true;
        }
    }
    return video;

}

