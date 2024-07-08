var noise = new SimplexNoise();
var vizInit = function (){
  var textInput = document.getElementById("textInput");
  var audio = document.getElementById("audio");
  var synthButton = document.getElementById("synthesizeButton");
    
  //can delete later - buttons to demonstrate animation status
  var idleButton = document.getElementById("idle");
      if (idleButton.addEventListener)
        idleButton.addEventListener("click",setIdleState);
  var loadingButton = document.getElementById("loading");
      if (loadingButton.addEventListener)
        loadingButton.addEventListener("click",setLoadingState);
  var talkingButton = document.getElementById("talking");
      if (talkingButton.addEventListener)
        talkingButton.addEventListener("click",setTalkingState);

   // Button to change shape to heart
  var heartButton = document.getElementById("heart");
    if (heartButton.addEventListener)
      heartButton.addEventListener("click", setHeartShape);


      var animationState = 'idle';
      var ball, group, scene, renderer, camera;

  //enter button. on click, synthesize audio to animation 
  synthButton.onclick = function () {
    var text = textInput.value;
    synthesizeText(text);
  };

  
  function synthesizeText(text) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    
    const raw = JSON.stringify({
      "question": text
    });
    
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow"
    };

    setLoadingState();
    
    fetch("https://embed.agora.newton.n42.zone/synthesize", requestOptions)
      .then((response) => response.text())
      .then((result) => {
        const obj = JSON.parse(result)
        const base64Audio = obj.audio;
        audio.src = "data:audio/mp3;base64," + base64Audio;
        audio.load();
        audio.play();
        setTalkingState();
        play();
      })
    .catch((error) => {
      console.error('Error:', error)
      setIdleState();
    });
  }

  function setIdleState(){
    animationState = 'idle';
  }
  function setLoadingState() {
    animationState = 'loading';
  }
  function setTalkingState() {
    animationState = 'talking';
  }
  function setHeartShape() {
    animationState = 'heart';
    const heartMesh = createHeartMesh();
    heartMesh.position.copy(ball.position);
    group.remove(ball);
    group.add(heartMesh);
    ball = heartMesh;
  }
    
  function play() {
    var context = new (window.AudioContext || window.webkitAudioContext)();
    var src = context.createMediaElementSource(audio);
    var analyser = context.createAnalyser();
    src.connect(analyser);
    analyser.connect(context.destination);
    analyser.fftSize = 512;
    var bufferLength = analyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);
    scene = new THREE.Scene();
    group = new THREE.Group();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0,0,100);
    camera.lookAt(scene.position);
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    var icosahedronGeometry = new THREE.IcosahedronGeometry(10, 4);
    var lambertMaterial = new THREE.MeshLambertMaterial({
      /*ball color in hex code*/
      color: 0xcc00
          
      //when wireframe is enabled: ball is NOT solid, has lines in it
       //wireframe: true
    });

    ball = new THREE.Mesh(icosahedronGeometry, lambertMaterial);
    ball.position.set(0, 0, 0);
    group.add(ball);

    var ambientLight = new THREE.AmbientLight(0xBFBFBF); //darker shadow underneath circle
    ambientLight.intensity = .3; //optional
    scene.add(ambientLight);

    var spotLight = new THREE.SpotLight(0xffffff); //white color on top of circle
    spotLight.intensity = 1.1;
    spotLight.position.set(-100, 100, 100); //angle of spotLight
    spotLight.lookAt(ball);
    spotLight.castShadow = true;
    scene.add(spotLight);
      
    scene.add(group);

    document.getElementById('out').appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);

    render();

    
    function render() {
      analyser.getByteFrequencyData(dataArray);

      var lowerHalfArray = dataArray.slice(0, (dataArray.length/2) - 1);
      var upperHalfArray = dataArray.slice((dataArray.length/2) - 1, dataArray.length - 1);

      var lowerMax = max(lowerHalfArray);
      var upperAvg = avg(upperHalfArray);

      var lowerMaxFr = lowerMax / lowerHalfArray.length;
      var upperAvgFr = upperAvg / upperHalfArray.length;
      
       // Ensure the ball remains a circle in loading state
       if (animationState !== 'loading' && animationState !== 'heart') {
        makeRoughBall(ball, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8), modulate(upperAvgFr, 0, 1, 0, 4));
      } else if(animationState == 'loading') {
        ball.geometry.vertices.forEach(function (vertex) {
          vertex.setLength(ball.geometry.parameters.radius);
        });
        ball.geometry.verticesNeedUpdate = true;
        ball.geometry.computeVertexNormals();
        ball.geometry.computeFaceNormals();
        ball.scale.set(1 + 0.2 * Math.sin(Date.now() * 0.01), 1 + 0.2 * Math.sin(Date.now() * 0.01), 1 + 0.2 * Math.sin(Date.now() * 0.01));
      }

      updateBallAnimation(ball);
      
      //OPTIONAL: ball rotates
      //group.rotation.y += 0.005; 
      
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function makeRoughBall(mesh, bassFr, treFr) {
      //let time = window.performance.now() * 0.00005;
      bassFr = bassFr / 2;
      mesh.geometry.vertices.forEach(function (vertex, i) {
        let offset = mesh.geometry.parameters.radius;
        treFr = 1; //makes it funky shaped while idles
            
        //depends on how funky you want it
        var amp = 4;
        var time = window.performance.now();
        vertex.normalize();
        var rf = 0.00001;
        var distance = (offset + bassFr ) + noise.noise3D(vertex.x + time *rf*7, vertex.y +  time*rf*8, vertex.z + time*rf*9) * amp * treFr;
        vertex.normalize().multiplyScalar(distance);
      });

      mesh.geometry.verticesNeedUpdate = true;
      mesh.geometry.normalsNeedUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeFaceNormals();
    }

    function updateBallAnimation(mesh) {
     // let time = Date.now() * 0.002;
      if (animationState === 'idle') {
          //mesh.scale.set(1 + 0.05 * Math.sin(time), 1 + 0.05 * Math.sin(time), 1 + 0.05 * Math.sin(time));
      } else if (animationState === 'loading') {
          bassFr = 0;
          treFr = 0;
          mesh.scale.set(1 + 0.2 * Math.sin(Date.now() * 0.01), 1 + 0.2 * Math.sin(Date.now() * 0.01), 1 + 0.2 * Math.sin(Date.now() * 0.01));
      } else if (animationState === 'talking') {
          var text = textInput.value;
          synthesizeText(text);
          //make shaders more intense to create depth??
      }
    }

  
  audio.play();
  } //end of play function


  play();
  setIdleState(); 

};
window.onload = vizInit;
document.body.addEventListener('touchend', function(ev) { context.resume(); });


function fractionate(val, minVal, maxVal) {
    return (val - minVal)/(maxVal - minVal);
}

function modulate(val, minVal, maxVal, outMin, outMax) {
    var fr = fractionate(val, minVal, maxVal);
    var delta = outMax - outMin;
    return outMin + (fr * delta);
}

function avg(arr){
    var total = arr.reduce(function(sum, b) { return sum + b; });
    return (total / arr.length);
}

function max(arr){
    return arr.reduce(function(a, b){ return Math.max(a, b); })
}
function createHeartShape() {
  const x = 0, y = 0;
  const heartShape = new THREE.Shape();
  heartShape.moveTo( x+5, y +5); //x + 5 is needed to make the right curved part of heart
  heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
  heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7,x - 6, y + 7 );
  heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
  heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
  heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
  heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );
  //heartShape.position.set(0, 0, 0);
  return heartShape;
}

function createHeartMesh() {
  const heartShape = createHeartShape();
  const geometry = new THREE.ShapeGeometry(heartShape);
  const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  const heartMesh = new THREE.Mesh(geometry, material);
  heartMesh.rotation.z = Math.PI; // Rotate the heart mesh 180 degrees
  //heartMesh.scale.set(1.5, 1.5, 1.5);
  heartMesh.position.set(0, 0, 0);
  return heartMesh;
}


function MeshMorpher(){
	this.geometries = [];
	this.mesh = null;
	var self = this;

	this.vertexOffset = [];

	this.updateGeometry = function(percent){
		if(!this.mesh){
			return;
		}

		var firstMesh = Math.floor(percent);
		var secondMesh = Math.ceil(percent);
		if(!this.geometries[firstMesh] || !this.geometries[secondMesh]){
			return;
		}

		while(percent > 1){
			percent -= 1;
		}

		var vertexCount = this.mesh.geometry.vertices.length;
		var vectorMath = new THREE.Vector3();

		for(var i = 0; i < vertexCount; i++){
			var pos1 = this.geometries[firstMesh].vertices[i].clone();
			var pos2 = this.geometries[secondMesh].vertices[i].clone();
			var tempPerc = percent + this.roundStep(percent) * this.vertexOffset[i];
			tempPerc = this.smooth(tempPerc);
			this.mesh.geometry.vertices[i].copy(vectorMath.lerpVectors(pos1, pos2, tempPerc));
		}
		this.mesh.geometry.verticesNeedUpdate = true;
		this.mesh.geometry.computeVertexNormals();
		this.mesh.geometry.computeFaceNormals();
	}

	this.addGeometry = function(geometry, pos){
		if(pos){
			this.geometries[pos] = geometry.clone();
		}
		else{
			this.geometries.push(geometry.clone());
		}
	}

	this.addFiles = function(urls){
		urls.forEach(function(url, pos){
			objLoader.load(url, function(mesh){
				var mesh = mesh.children[0];
				
				var geometry = new THREE.Geometry().fromBufferGeometry( mesh.geometry );
				mesh.geometry = geometry;
		
				if(pos == 0){
					self.mesh = mesh;

					mesh.material = new THREE.MeshPhongMaterial({color: 0x00ada7});
					mesh.material.shading = THREE.FlatShading;

					for(var i = 0; i < mesh.geometry.vertices.length; i++){
						var seed = mesh.geometry.vertices[i].x + mesh.geometry.vertices[i].y;
						self.vertexOffset[i] = self.random(seed)*0.1-0.05;

					}

					scene.add(self.mesh);
				}

				mesh.geometry.name = url;

				self.addGeometry(mesh.geometry, pos);
			});
		});
	}

	this.smooth = function(x){
		return -6*Math.pow(x, 3) + 9*Math.pow(x, 2) - 2*x;
	}

	this.roundStep = function(x){
		return 1-Math.pow(1-2*x, 2);
	}

	this.random = function(seed){
		return (1103515245 * seed + 12345) % 65536 / 65536;
	}
}


