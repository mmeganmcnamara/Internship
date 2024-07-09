//To do for final cleanup: delete binds line 80, delete volume and sensitivity slider, play and pause buttons?
/////////////////////////////////////////////////////////////////////////////////////////////////////

(function () {

	var root = this;  														// use global context rather than window object
	var waveform_array, old_waveform, objectUrl, metaHide, micStream;		// raw waveform data from web audio api
	var WAVE_DATA = []; 													// normalized waveform data used in visualizations

	// main app/init stuff //////////////////////////////////////////////////////////////////////////
	var a = {};	
	a.init = function() {
		console.log("a.init fired");
		
		
		// globals & state
		var s = {
			version: '1.6.0',
			debug: (window.location.href.indexOf("debug") > -1) ? true : false,
			// preziotte.com/partymode playlist
			//playlist: ['forgot.mp3', 'chaos.mp3', 'stop.mp3', 'bless.mp3', 'benares.mp3', 'radio.mp3', 'selftanner.mp3', 'startshootin.mp3', 'track1.mp3', 'holdin.m4a', 'waiting.mp3', 'dawn.mp3', 'analog.mp3', 'settle.mp3', 'crackers.mp3', 'nuclear.mp3', 'madness.mp3', 'magoo.mp3', 'around.mp3', 'where.mp3', 'bird.mp3', 'notes.mp3'],
			// example playlist
			playlist: ['Avataraudio-Test.mp3'],
			//playListLinks: ['http://www.iamsirch.com/', 'https://soundcloud.com/mononome'],
			width : $(document).width(),
			height : $(document).height(),
			sliderVal: 50,												// depricated -- value of html5 slider
			canKick: true,												// rate limits auto kick detector
			metaLock: false,											// overrides .hideHUD() when song metadata needs to be shown
			fastHide : (h.getURLParameter('fastHide')) ? 100 : null,
			shuffle : false,

			vendors : ['-webkit-', '-moz-', '-o-', ''],
			protocol : window.location.protocol,

			drawInterval: 1000/24,										// 1000ms divided by max framerate
			then: Date.now(),											// last time a frame was drawn
			trigger: 'circle',											// default visualization

			hud: 1,														// is hud visible?
			active: null,												// active visualization (string)
			vizNum: 0,													// active visualization (index number)
			thumbs_init: [0,0,0,0,0,0,0,0],								// are thumbnails initialized?
			theme: 0, 													// default color palette
			currentSong : 0,											// current track

			audioURL: null,

			loop: 1,													// current loop index
			//loopDelay: [null,20000,5000,1000],							// array of loop options
			//loopText: ['off', 'every 20s', 'every 5s', 'every 1s'],
			changeInterval: null										// initialize looping setInterval id

		};
		root.State = s;


		root.context = new (window.AudioContext || window.webkitAudioContext)();

		// append main svg element
		root.svg = d3.select("body").append("svg").attr('id', 'viz')
				.attr("width", State.width)
				.attr("height", State.height);

		a.bind();			// attach all the handlers
		//a.keyboard();		// bind all the shortcuts

		if (window.location.protocol.search('chrome-extension') >= 0) {
			a.findAudio();
			return;
		}
		
		if (h.getURLParameter('audio') != null)
			a.loadAudioFromURL(h.getURLParameter('audio'));
		else
			a.loadSound();

		};
	
	a.bind = function() {
		console.log("a.bind fired");
		var click = (Helper.isMobile()) ? 'touchstart' : 'click';
		$('.buffer').on(click, function() { window.location.href='http://preziotte.com' });
		$('.song-metadata').on(click, h.songGo);
		$('.icon-pause').on(click, h.togglePlay);
		$('.icon-play').on(click, h.togglePlay);
		$('.icon-forward2').on(click, function() { h.changeSong('n'); });
		$('.icon-backward2').on(click, function() { h.changeSong('p'); });
		//$('.icon-expand').on(click, h.toggleFullScreen);
		$('.icon-microphone').on(click, a.microphone);

		//$('.icon-volume-medium').on(click, function() { audio.muted = (audio.muted == true) ? false : true; });

		$('.md-close').on(click, h.hideModals);
		$('#slider').on('input change', function() { analyser.smoothingTimeConstant = 1-(this.value/100); }); 
		$('#slider').on('change', function() { $('#slider').blur(); }); 
		//$('#slider-volume').on('input change', function() { audio.volume = (this.value/100); });
		//$('#slider-volume').on('change', function() { $('#slider-volume').blur(); });
		$('.i').on('mouseenter', h.tooltipReplace);
		$('.i').on('mouseleave', h.tooltipUnReplace);

		$(document).on('dragenter', h.stop );
		$(document).on('dragover', h.stop);
		$(document).on('drop', h.handleDrop );

		document.addEventListener("waveform", function (e) { 
			//console.log(e.detail);
			waveform_array = e.detail;
			//audio = this;
		}, false);

		$('body').on('click', function() {
			// satisfy chrome autoplay policy changes
			// https://developers.google.com/web/updates/2017/09/autoplay-policy-changes#webaudio
			if (context.state != 'suspended') return;
			context.resume().then(() => {
			    console.log('playback resumed successfully');
			});
		});
		// update state on window resize
		window.onresize = function(event) { h.resize(); };
		$(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', h.resize);  //http://stackoverflow.com/a/9775411


		};
	/*a.keyboard = function() {
		console.log("a.keyboard fired");

		Mousetrap.bind('esc', h.hideModals);
		Mousetrap.bind('space', h.togglePlay);
		Mousetrap.bind('f', h.toggleFullScreen); 
		Mousetrap.bind('c', function() { h.changeSong(); });

		Mousetrap.bind('v', function() { h.changeSong('n'); });
		Mousetrap.bind('x', function() { h.changeSong('p'); });
		Mousetrap.bind('r', function() { h.toggleShuffle(); });

		Mousetrap.bind('1', function() { State.trigger = 'circle'; });

		Mousetrap.bind('up', function() { h.vizChange(State.vizNum-1); });
		Mousetrap.bind('down', function() { h.vizChange(State.vizNum+1); });
		Mousetrap.bind('left', function() { h.themeChange(State.theme-1); });
		Mousetrap.bind('right', function() { h.themeChange(State.theme+1); });

		};*/

	a.loadSound = function() {
		console.log("a.loadSound fired");

		if (navigator.userAgent.search("Safari") >= 0 && navigator.userAgent.search("Chrome") < 0) {
			console.log(" -- sound loaded via ajax request");
			$('.menu-controls').hide();
			a.loadSoundAJAX();
		}
		else {
			console.log(" -- sound loaded via html5 audio");
			var path = 'mp3/'+State.playlist[0];
			a.loadSoundHTML5(path);
	    	h.readID3(path);
		}

		};
	a.loadSoundAJAX = function() {
		console.log('a.loadSoundAJAX fired');

		audio = null;
	    var request = new XMLHttpRequest();
	    request.open("GET", "mp3/"+State.playlist[0], true);
	    request.responseType = "arraybuffer";
	 
	    request.onload = function(event) {
	        var data = event.target.response;
	 
	        a.audioBullshit(data);
	    };
	 
	    request.send();

		};
	a.loadSoundHTML5 = function(f) {
		console.log('a.loadSoundHTML5 fired');

		audio = new Audio();
		//audio.remove();
		audio.src = f; 
	    //audio.controls = true;
	    //audio.loop = true;
	    audio.autoplay = true;
	    audio.crossOrigin = "anonymous";
 		audio.addEventListener('ended', function() { h.songEnded(); }, false);
    // audio.addEventListener('loadedmetadata', loadedMetadata, false);

		$('#audio_box').empty();
		document.getElementById('audio_box').appendChild(audio);
        a.audioBullshit();

		};

	a.loadAudioFromURL = function(url) {
		State.audioURL = url;
		if (State.audioURL) {
			a.loadSoundHTML5(url);
			return;
		}
		};
	a.microphone = function() {
		// this will only work over an https connection (or running the app locally)
		console.log('a.microphone fired');
		if (State.protocol.indexOf('https') == -1) {
			console.log("WARNING:: Accessing the microphone is only available using https://");
		}
		navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

		if (!micStream) {
			if (navigator.getUserMedia) {
				navigator.getUserMedia({audio: true, video: false}, function(stream) {
					micStream = true;
					console.log(" --> audio being captured");
		      context = new (window.AudioContext || window.webkitAudioContext)();
		      source = context.createMediaStreamSource(stream);
		      analyser = context.createAnalyser();
		      source.connect(analyser);
					console.log(micStream);
					audio.pause();
				}, h.microphoneError);
			} else {
			  // fallback.
			}
		}
		else {
			console.log(" --> turning off")
			source.disconnect();
			micStream = false;
			audio.play();
		}

		};

	a.audioBullshit = function (data) {
		// uses web audio api to expose waveform data
		console.log("a.audioBullshit fired");

		root.analyser = context.createAnalyser();
        //analyser.smoothingTimeConstant = .4; // .8 default
		
		if (navigator.userAgent.search("Safari") >= 0 && navigator.userAgent.search("Chrome") < 0) {
	        root.source = context.createBufferSource();
	        source.buffer = context.createBuffer(data, false);
	        source.loop = true;
	        source.noteOn(0);
	    }
	    else {
	    	// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext.createScriptProcessor
	 		root.source = context.createMediaElementSource(audio);  // doesn't seem to be implemented in safari :(
	 		//root.source = context.createMediaStreamSource()
	 		//root.source = context.createScriptProcessor(4096, 1, 1);  

	    }

		source.connect(analyser);
		analyser.connect(context.destination);

		a.frameLooper();
		};
	a.findAudio = function() {
		// unused.
		console.log("a.findAudio fired");

		$('video, audio').each(function() {
			//h.loadSoundHTML5(this.src);
			// if .src?  if playing?
			audio = this;
			a.audioBullshit();
		});

		//$('object')
		//swf?  SWFObject?
		// can use soundmanager2 -- > http://schillmania.com/projects/soundmanager2/
		// waveformData in sound object gives 256 array.  just multiply by 4?

		};
	a.frameLooper = function(){
		//console.log("a.frameLooper fired");

		// recursive function used to update audio waveform data and redraw visualization

		window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
	 	window.requestAnimationFrame(a.frameLooper);

	    now = Date.now();
	    delta = now - State.then;
	    

	    // some framerate limiting logic -- http://codetheory.in/controlling-the-frame-rate-with-requestanimationframe/
	    if (delta > State.drawInterval) {
	        State.then = now - (delta % State.drawInterval);
	    
			// update waveform data
			if (h.detectEnvironment() != 'chrome-extension') {
			 	waveform_array = new Uint8Array(analyser.frequencyBinCount);
			 	analyser.getByteFrequencyData(waveform_array);
			 	//analyser.getByteTimeDomainData(waveform_array);
			}
			
			// if (c.kickDetect(95)) {
			// 	h.themeChange(Math.floor(Math.random() * 6));
			//  	h.vizChange(Math.floor(Math.random() * 7));
			// }

			// draw all thumbnails
		 	r.circle_thumb();

		 	// draw active visualizer
			//TO DO: delete unwated visualizer
			switch (State.trigger) {
			  
			  default:
			  	State.vizNum = 0;
			    r.circle();
			  	break;
			};

		}

		}
	root.App = a;

	// manipulating/normalizing waveform data ///////////////////////////////////////////////////////
	var c = {}; 
	c.kickDetect = function(threshold) {
		var kick = false;

		var deltas = $(waveform_array).each(function(n,i) {
			if (!old_waveform) return 0;
			else return old_waveform[i]-n;
		});
		var s = d3.sum(deltas)/1024;

		if (s>threshold && State.canKick) {
			kick = true;
			State.canKick = false;
	        setTimeout(function(){
	            State.canKick = true;
	        }, 5000);
		}

		root.old_waveform = waveform_array;

		return kick;
	};
	c.normalize = function(coef, offset, neg) {

		//https://stackoverflow.com/questions/13368046/how-to-normalize-a-list-of-positive-numbers-in-javascript

		var coef = coef || 1;
		var offset = offset || 0;
		var numbers = waveform_array;
		var numbers2 = [];
		var ratio = Math.max.apply( Math, numbers );
		var l = numbers.length
		//l is the length of waveform array
		for (var i = 0; i < l; i++ ) {
			if (numbers[i] == 0)
				numbers2[i] = 0 + offset;
			else
				numbers2[i] = ((numbers[i]/ratio) * coef) + offset;

			if (i%2 == 0 && neg)
				numbers2[i] = -Math.abs(numbers2[i]);
		}
		return numbers2;
		
	};
		//so takes the statistics of the wavefroms (from web audio API), bins them (look up bins histogram), then 
	c.normalize_binned = function(binsize, coef, offset, neg) {

		var numbers = [];
		var temp = 0;
	 	for (var i = 0; i < waveform_array.length; i++) {
	 		temp += waveform_array[i];
	    	if (i%binsize==0) {
	    		numbers.push(temp/binsize);
	    		temp = 0;
	    	}
	  	}

		var coef = coef || 1;
		var offset = offset || 0;
		var numbers2 = [];
		var ratio = Math.max.apply( Math, numbers );
		var l = numbers.length

		for (var i = 0; i < l; i++ ) {
			if (numbers[i] == 0)
				numbers2[i] = 0 + offset;
			else
				numbers2[i] = ((numbers[i]/ratio) * coef) + offset;

			if (i%2 == 0 && neg)
				numbers2[i] = -Math.abs(numbers2[i]);
		}
		return numbers2;
		
	};
	c.total = function() { return Math.floor(d3.sum(waveform_array)/waveform_array.length); };
	c.total_normalized = function() {};
	c.bins_select = function(binsize) {
		var copy = [];
	 	for (var i = 0; i < 500; i++) {
	    	if (i%binsize==0)
	    		copy.push(waveform_array[i]);
	  	}
	  	return copy;
	};
	c.bins_avg = function(binsize) {
		var binsize = binsize || 100;
		var copy = [];
		var temp = 0;
	 	for (var i = 0; i < waveform_array.length; i++) {
	 		temp += waveform_array[i];
	    	if (i%binsize==0) {
	    		copy.push(temp/binsize);
	    		temp = 0;
	    	}
	  	}
	  	//console.log(copy);
	  	return copy;
	};	
	root.Compute = c;

	// rendering svg based on normalized waveform data //////////////////////////////////////////////
	var r = {};	
	r.circle = function() {

		if (State.active != 'circle') {
			State.active = 'circle';
			$('body > svg').empty();
		}

	 	WAVE_DATA = c.bins_select(70);

		var x = d3.scale.linear()
			.domain([0, d3.max(WAVE_DATA)])
			.range([0, 420]);

		var slideScale = d3.scale.linear()
			.domain([1, 100])
			.range([0, .5]);

		root.bars = svg.selectAll("circle")
				.data(WAVE_DATA, function(d) { return d; });

		// bars.attr("r", function(d) { return x(d) + ""; })
		// 	.attr('transform', "scale("+slideScale(State.sliderVal)+")")
		// 	.attr("cy", function(d, i) { return '50%'; })
		// 	.attr("cx", function(d, i) { return '50%'; });

		bars.enter().append("circle")
			.attr('transform', "scale("+slideScale(State.sliderVal)+")")
			.attr("cy", function(d, i) { return '50%'; })
			.attr("cx", function(d, i) { return '50%'; })
			.attr("r", function(d) { return x(d) + ""; });

		bars.exit().remove();

		};
	r.circle_thumb = function() {

		if (State.thumbs_init[0] != 'init') {
			State.thumbs_init[0] = 'init';
			root.svg_thumb_one = d3.select("#circle").append("svg")
				.attr("width", '100%')
				.attr("height", '100%');
		}

	 	WAVE_DATA = c.bins_select(200);

		var x_t1 = d3.scale.linear()
			.domain([0, d3.max(WAVE_DATA)])
			.range([0, 80]);

		var bars_t1 = svg_thumb_one
			.selectAll("circle")
			.data(WAVE_DATA, function(d) { return d; });

		// bars_t1.attr("r", function(d) { return x_t1(d) + ""; })
		// 	.attr("cy", function(d, i) { return '50%'; })
		// 	.attr("cx", function(d, i) { return '50%'; });

		bars_t1.enter().append("circle")
			.attr("cy", function(d, i) { return '50%'; })
			.attr("cx", function(d, i) { return '50%'; })
			.attr("r", function(d) { return x_t1(d) + ""; });

		bars_t1.exit().remove();
		}

	root.Render = r;

	// helper methods ///////////////////////////////////////////////////////////////////////////////
	var h = {};
	/*h.toggleFullScreen = function() {
		console.log("h.toggleFullScreen fired");

		// thanks mdn

		if (!document.fullscreenElement &&    // alternative standard method
		  !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods

		  	$('.icon-expand').addClass('icon-contract');
			if (document.documentElement.requestFullscreen) {
				document.documentElement.requestFullscreen();
			} else if (document.documentElement.msRequestFullscreen) {
				document.documentElement.msRequestFullscreen();
			} else if (document.documentElement.mozRequestFullScreen) {
				document.documentElement.mozRequestFullScreen();
			} else if (document.documentElement.webkitRequestFullscreen) {
				document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
			}
		} else {
		  	$('.icon-expand').removeClass('icon-contract');
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		}
		}*/
	h.hideHUD = function() {
		//$('.icon-knobs').is(':hover') || 
		if ($('#mp3_player').is(':hover')|| $('#slider').is(':hover') || $('#slider-volume').is(':hover')  || $('.song-metadata').is(':hover') || $('.icon-forward2').is(':hover') || $('.icon-backward2').is(':hover') || $('.icon-pause').is(':hover') || $('.schover').is(':hover'))
			return;

		$('#mp3_player').addClass('fadeOut');
		$('html').addClass('noCursor');
		if (State.metaLock == false)
			$('.song-metadata').removeClass("show-meta");

		State.hud = 0;
		}
	h.showHUD = function() {

		$('#mp3_player').removeClass('fadeOut');
		$('html').removeClass('noCursor');
		$('.song-metadata').addClass("show-meta");

		State.hud = 1;

		}
	h.showModal = function(id) {
		if ($(id).hasClass('md-show')) {
			h.hideModals();
			return;
		}

		if ($('.md-show').length > 0) {
			h.hideModals();
		}

		$(id).addClass('md-show');
		
		};
	h.hideModals = function() {
		$('.md-modal').removeClass('md-show');
		};

	h.resize = function() {
		console.log('h.resize fired');		
	    State.width = $(window).width();
		State.height = $(window).height();
		State.active = State.trigger;
		$('body > svg').attr("width", State.width).attr("height", State.height);

		var full = document.fullscreen || document.webkitIsFullScreen || document.mozFullScreen;
		if (!full) $('.icon-expand').removeClass('icon-contract');

		};
	h.stop = function(e) {
    e.stopPropagation();
    e.preventDefault();
		};
	h.handleDrop = function(e) {
		console.log('h.handleDrop fired');

		h.stop(e);
		//if (window.File && window.FileReader && window.FileList && window.Blob) {

    	URL.revokeObjectURL(objectUrl);		
    	var file = e.originalEvent.dataTransfer.files[0];

		if (!file.type.match(/audio.*/)) {
			console.log("not audio file");
			return;
		}

    	h.readID3(file);

    	var objectUrl = URL.createObjectURL(file);
    	a.loadSoundHTML5(objectUrl);

			   //  	var files = e.originalEvent.dataTransfer.files;

			   //  	if (files[0].type.match(/audio.*/)) {
			   //  		console.log('true');
				
						// var read = new FileReader(); 
						// read.readAsDataURL(files[0]);
						// read.onload = function(e) { 
						// 	console.log(' -- FileReader onload fired');
							
						// 	// fuuzikplay[3] = soundManager.createSound({ 
						// 	// id: "audio", 
						// 	// url: d.target.result 
						// 	// }); 
						// 	//audio.pause(); 
				   			
				  //  			audio = new Audio();
						// 	audio.src = e.target.result; 
						//     audio.controls = true;
						//     audio.loop = true;
						//     audio.autoplay = true;

						//     $('#audio_box').empty();
						// 	document.getElementById('audio_box').appendChild(audio);
					 //        a.audioBullshit();

						// };
			   //  	}
		
		};
	h.readID3 = function(file) {
		console.log('h.readID3 fired');

		$('.song-metadata').html("");

		if (typeof file == 'string') {

			ID3.loadTags(audio.src, function() {
			    var tags = ID3.getAllTags(audio.src);
				//h.renderSongTitle(tags);
			});

		}

		else {
			console.log("Does this print?");
			ID3.loadTags(file.urn || file.name, function() {
			    var tags = ID3.getAllTags(file.urn || file.name);
			    tags.dragged = true;
				//h.renderSongTitle(tags);

			    if( "picture" in tags ) {
			    	var image = tags.picture;
			    	var base64String = "";
			    	for (var i = 0; i < image.data.length; i++) {
			    		base64String += String.fromCharCode(image.data[i]);
			    	}
			    	//console.log("data:" + image.format + ";base64," + window.btoa(base64String));
			    	//$("art").src = "data:" + image.format + ";base64," + window.btoa(base64String);
			    	//$("art").style.display = "block";
			    } 
			    else {
			    	//console.log("nope.");
			    	//$("art").style.display = "none";
			    }
			}, {
			    dataReader: FileAPIReader(file)
			});
		}

		};
/* /////// commenting out toggleShuffle and changeSong changed the size of the circle ////*/
	/*h.toggleShuffle = function() {
		State.shuffle = !State.shuffle;
		console.log('shuffe:'+State.shuffle);
		}*/
	h.togglePlay = function() {
		(audio && audio.paused == false) ? audio.pause() : audio.play();
		$('.icon-pause').toggleClass('icon-play');
		};
	h.songEnded = function() {
		console.log('h.songEnded fired');		

		//h.changeSong('n');

		};
	/*h.changeSong = function(direction) {
		console.log('h.changeSong fired');		

		var totalTracks = State.soundCloudTracks || State.playlist.length;

		if (State.soundCloudData && State.soundCloudTracks <= 1) {
			audio.currentTime = 0;
			$('.icon-pause').removeClass('icon-play');
			return;
		}

		if (State.shuffle == true) {
			console.log("shuffling song ("+totalTracks+" total)");
			State.currentSong = Math.ceil(Math.random()*totalTracks);
			console.log(State.currentSong);
		}

		if (direction == 'n')
			State.currentSong = State.currentSong + 1;

		else if (direction == 'p') {
			if (audio.currentTime < 3) {
				State.currentSong = (State.currentSong <= 0) ? State.currentSong+totalTracks-1 : State.currentSong - 1;
			}
			else {
				audio.currentTime = 0;
				$('.icon-pause').removeClass('icon-play');
				return;
			}
		}
		else {
			State.currentSong = Math.floor(Math.random() * totalTracks);
		}

	
		if (audio) {
			audio.src = 'mp3/'+State.playlist[Math.abs(State.currentSong)%State.playlist.length];
			h.readID3(audio.src);
		}

		$('.icon-pause').removeClass('icon-play');

		};*/
	h.tooltipReplace = function() {
		console.log('h.tooltipReplace fired');

		var text = $(this).attr('data-hovertext');
		console.log(text);
		if (text != null) {
			State.hoverTemp = $('.song-metadata').html();
			$('.song-metadata').html(text);
		}
	
		};
	h.tooltipUnReplace = function() {
		console.log('h.tooltipUnReplace fired');
		
		if (State.hoverTemp != null) {
			$('.song-metadata').html(State.hoverTemp);
			State.hoverTemp = null;
		}

		};
	h.songGo = function() {
		console.log('h.songGo fired.');

		if (!$(this).attr('data-go'))
			return false;
		audio.pause();
		$('.icon-pause').removeClass('icon-play');
		window.open($(this).attr('data-go'),'_blank');
		
		};

	h.icosahedronFaces = function(slide) {
		var slide = slide || 180;
		var faces = [],
		  y = Math.atan2(1, 2) * slide / Math.PI;
		for (var x = 0; x < 360; x += 72) {
		faces.push(
		  [[x +  0, -90], [x +  0,  -y], [x + 72,  -y]],
		  [[x + 36,   y], [x + 72,  -y], [x +  0,  -y]],
		  [[x + 36,   y], [x +  0,  -y], [x - 36,   y]],
		  [[x + 36,   y], [x - 36,   y], [x - 36,  90]]
		);
		}
		return faces;
		};
	h.degreesToRads = function(n) {
    return d3.scale.linear().domain([0, 360]).range([0, 2 * Math.PI])(this);
  	};

	h.microphoneError = function(e) {
		// user clicked not to let microphone be used
		console.log(e);
		};
    h.getURLParameter = function(sParam) {
    	//http://www.jquerybyexample.net/2012/06/get-url-parameters-using-jquery.html
	    var sPageURL = window.location.search.substring(1);
	    var sURLVariables = sPageURL.split('&');
	    for (var i = 0; i < sURLVariables.length; i++) {
	        var sParameterName = sURLVariables[i].split('=');
	        if (sParameterName[0] == sParam) {
	            return sParameterName[1];
	        }
	    }
		};
	h.isMobile = function() {
		// returns true if user agent is a mobile device
		return (/iPhone|iPod|iPad|Android|BlackBerry/).test(navigator.userAgent);
		};
	h.detectEnvironment = function() {
		if (window.location.protocol.search('chrome-extension') >= 0)
			return 'chrome-extension';

		if (navigator.userAgent.search("Safari") >= 0 && navigator.userAgent.search("Chrome") < 0)
			return 'safari';

		//  https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
		
		if (!!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0)
			return 'opera';

		if (typeof InstallTrigger !== 'undefined')
			return 'firefox';

		// var isChrome = !!window.chrome && !isOpera;              // Chrome 1+
		// var isIE = /*@cc_on!@*/false || !!document.documentMode; // At least IE6

		return 'unknown';

		};
	h.getCookie = function(c_name) {
		//console.log("h.getCookie fired");
		var i,x,y,ARRcookies=document.cookie.split(";");
		for (i=0;i<ARRcookies.length;i++) {
		  x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
		  y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
		  x=x.replace(/^\s+|\s+$/g,"");
		  if (x==c_name) {
		    return unescape(y);
		  }
		}
		};
	h.setCookie = function(c_name,value,exdays) {
		//console.log("h.setCookie fired");
		var exdate=new Date();
		exdate.setDate(exdate.getDate() + exdays);
		var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
		document.cookie=c_name + "=" + c_value;
		};
	h.prettyLog = function(data) {
		console.log("h.prettyLog fired");
		return false;
		
		var x = data || localStorage.account;
		if (typeof x == 'object') x = JSON.stringify(x);
		if (typeof data == "undefined") return;
		if (typeof data == "string") {
			console.log(data);
			return;
		}
		console.log('\n'+JSON.stringify(JSON.parse(x),null, 4));
		};
	h.applyStyles = function(selector, styleToApply){
		if(typeof selector == undefined) return;
		if(typeof styleToApply == undefined) return;

		var style = '';
		for (var i = 0; i < State.vendors.length; i++) {
			style += State.vendors[i]+ styleToApply;
		}
		$(selector).attr("style", style);
		};
	root.Helper = h;

}).call(this);

$(document).ready(App.init);

