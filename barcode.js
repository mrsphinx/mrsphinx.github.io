var barcode = function () {

	var localMediaStream = null;
	var bars = [];
	var handler = null;
	var currentDeviceId;
	var dimensions = {
		height: 0,
		width: 0,
		start: 0,
		end: 0
	}

	var elements = {
		video: null,
		canvas: null,
		ctx: null,
		canvasg: null,
		ctxg: null,

		canvasGraph: null,
		ctxGraph: null
	}

	var upc = {
		'0': [3, 2, 1, 1],
		'1': [2, 2, 2, 1],
		'2': [2, 1, 2, 2],
		'3': [1, 4, 1, 1],
		'4': [1, 1, 3, 2],
		'5': [1, 2, 3, 1],
		'6': [1, 1, 1, 4],
		'7': [1, 3, 1, 2],
		'8': [1, 2, 1, 3],
		'9': [3, 1, 1, 2]
	};

	var check = {
		'oooooo': '0',
		'ooeoee': '1',
		'ooeeoe': '2',
		'ooeeeo': '3',
		'oeooee': '4',
		'oeeooe': '5',
		'oeeeoo': '6',
		'oeoeoe': '7',
		'oeoeeo': '8',
		'oeeoeo': '9'
	}

	var config = {
		strokeColor: '#f00',
		start: 0.1,
		end: 0.9,
		threshold: 160,
		quality: 0.45,
		delay: 500,
		video: '',
		canvas: '',
		canvasg: ''
	}

	function init() {
		console.log('enter init')
		window.URL = window.URL || window.webkitURL;
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

		elements.video = document.querySelector(config.video);
		elements.canvas = document.querySelector(config.canvas);
		elements.ctx = elements.canvas.getContext('2d');
		elements.canvasg = document.querySelector(config.canvasg);
		elements.ctxg = elements.canvasg.getContext('2d');
		elements.canvasGraph = document.getElementById('graph');
		elements.ctxGraph = elements.canvasGraph.getContext('2d');
		console.log(elements)
		if (navigator.getUserMedia) {
			let configUserMedia = {
				audio: false,
				video: {}
			};
			// checkCamera();
			configUserMedia.video = currentDeviceId ? { deviceId: currentDeviceId } : { facingMode: "environment" };
			stopStream();
			navigator.mediaDevices.getUserMedia(configUserMedia).then(function (stream) {
				console.log(stream)
				// elements.video.src = window.URL.createObjectURL(stream);
				elements.video.srcObject = stream;
			}, function (error) {
				console.log(error);
			});
		}

		elements.video.oncanplay = function (e) {
			dimensions.height = elements.video.videoHeight;
			dimensions.width = elements.video.videoWidth;

			dimensions.start = dimensions.width * config.start;
			dimensions.end = dimensions.width * config.end;

			elements.canvas.width = dimensions.width;
			elements.canvas.height = dimensions.height;
			elements.canvasg.width = dimensions.width;
			elements.canvasg.height = dimensions.height;

			drawGraphics();
			setInterval(function () { snapshot() }, config.delay);

		}

		console.log('end init')
		console.log(elements.canvas.width + "px, " + elements.canvas.height + "px");
		console.log(elements.canvasg.width + "px, " + elements.canvasg.height + "px, ");
	}
	function checkCamera() {
		console.log('check camera')
		navigator.mediaDevices.enumerateDevices()
			.then(function (devices) {
				devices = devices.filter(function (device) {
					return device.kind === 'videoinput';
				});

				if (devices.length > 1) {

					currentDeviceId = devices[0].deviceId; // no way to know current MediaStream's device id so arbitrarily choose the first
				}
			});
	}

	function snapshot() {
		elements.ctx.drawImage(elements.video, 0, 0, dimensions.width, dimensions.height);
		processImage();
	}

	function stopStream() {
		console.log('stop stream')
		if (elements.video.srcObject) {
			elements.video.srcObject.getTracks()[0].stop();
		}
	}

	function processImage() {

		bars = [];

		var pixels = [];
		var binary = [];
		var pixelBars = [];

		// convert to grayscale

		var imgd = elements.ctx.getImageData(dimensions.start, dimensions.height * 0.5, dimensions.end - dimensions.start, 1);

		var rgbpixels = imgd.data;

		for (var i = 0, ii = rgbpixels.length; i < ii; i = i + 4) {
			pixels.push(Math.round(rgbpixels[i] * 0.2126 + rgbpixels[i + 1] * 0.7152 + rgbpixels[i + 2] * 0.0722));
		}

		// normalize and convert to binary

		var min = Math.min.apply(null, pixels);
		var max = Math.max.apply(null, pixels);
		let roundd = []
		for (var i = 0, ii = pixels.length; i < ii; i++) {
			// roundd.push(Math.round((pixels[i] - min) / (max - min) * 255))
			if (Math.round((pixels[i] - min) / (max - min) * 255) > config.threshold) {
				roundd.push(255)

				binary.push(1);
			} else {
				roundd.push(0)
				binary.push(0);
			}
		}
		drawGraph(pixels, roundd)
		// determine bar widths

		var current = binary[0];
		var count = 0;

		for (var i = 0, ii = binary.length; i < ii; i++) {
			if (binary[i] == current) {
				count++;
			} else {
				pixelBars.push(count);
				count = 1;
				current = binary[i]
			}
		}
		pixelBars.push(count);
		// quality check

		if (pixelBars.length < (3 + 24 + 5 + 24 + 3 + 1)) {
			return;
		}

		// find starting sequence

		var startIndex = 0;
		var minFactor = 0.5;
		var maxFactor = 1.5;

		for (var i = 3, ii = pixelBars.length; i < ii; i++) {
			var refLength = (pixelBars[i] + pixelBars[i - 1] + pixelBars[i - 2]) / 3;
			if (
				(pixelBars[i] > (minFactor * refLength) || pixelBars[i] < (maxFactor * refLength))
				&& (pixelBars[i - 1] > (minFactor * refLength) || pixelBars[i - 1] < (maxFactor * refLength))
				&& (pixelBars[i - 2] > (minFactor * refLength) || pixelBars[i - 2] < (maxFactor * refLength))
				&& (pixelBars[i - 3] > 3 * refLength)
			) {
				startIndex = i - 2;
				break;
			}
		}

		console.log("startIndex: " + startIndex);

		// return if no starting sequence found

		if (startIndex == 0) {
			return;
		}

		// discard leading and trailing patterns

		pixelBars = pixelBars.slice(startIndex, startIndex + 3 + 24 + 5 + 24 + 3);

		// console.log("pixelBars: " + pixelBars);

		// calculate relative widths

		var ref = (pixelBars[0] + pixelBars[1] + pixelBars[2]) / 3;

		for (var i = 0, ii = pixelBars.length; i < ii; i++) {
			bars.push(Math.round(pixelBars[i] / ref * 100) / 100);
		}



		// analyze pattern

		analyze();

	}

	function analyze() {

		console.clear();

		console.log("analyzing");
		// console.log(bars)
		// drawGraph(bars);
		// determine parity first digit and reverse sequence if necessary

		var first = normalize(bars.slice(3, 3 + 4), 7);
		if (!isOdd(Math.round(first[1] + first[3]))) {
			bars = bars.reverse();
		}

		// split into digits
		// drawGraph(bars);

		var digits = [

			normalize(bars.slice(3, 3 + 4), 7),
			normalize(bars.slice(7, 7 + 4), 7),
			normalize(bars.slice(11, 11 + 4), 7),
			normalize(bars.slice(15, 15 + 4), 7),
			normalize(bars.slice(19, 19 + 4), 7),
			normalize(bars.slice(23, 23 + 4), 7),
			normalize(bars.slice(32, 32 + 4), 7),
			normalize(bars.slice(36, 36 + 4), 7),
			normalize(bars.slice(40, 40 + 4), 7),
			normalize(bars.slice(44, 44 + 4), 7),
			normalize(bars.slice(48, 48 + 4), 7),
			normalize(bars.slice(52, 52 + 4), 7)
		]

		// console.log("digits: " + digits);
		// determine parity and reverse if necessary

		var parities = [];

		for (var i = 0; i < 6; i++) {
			if (parity(digits[i])) {
				parities.push('o');
			} else {
				parities.push('e');
				digits[i] = digits[i].reverse();
			}
		}

		// identify digits

		var result = [];
		var quality = 0;
		// drawGraph(digits.flat())

		for (var i = 0, ii = digits.length; i < ii; i++) {

			var distance = 9;
			var bestKey = '';

			for (key in upc) {
				if (maxDistance(digits[i], upc[key]) < distance) {
					distance = maxDistance(digits[i], upc[key]);
					bestKey = key;
				}
			}

			result.push(bestKey);
			if (distance > quality) {
				quality = distance;
			}

		}

		console.log("result: " + result);

		// check digit

		var checkDigit = check[parities.join('')];

		// output

		console.log("quality: " + quality);

		if (quality < config.quality) {
			if (handler != null) {
				handler(checkDigit + result.join(''));
			}
		}

	}

	function setHandler(h) {
		handler = h;
	}

	function normalize(input, total) {
		var sum = 0;
		var result = [];
		for (var i = 0, ii = input.length; i < ii; i++) {
			sum = sum + input[i];
		}
		for (var i = 0, ii = input.length; i < ii; i++) {
			result.push(input[i] / sum * total);
		}
		return result;
	}

	function isOdd(num) {
		return num % 2;
	}

	function maxDistance(a, b) {
		var distance = 0;
		for (var i = 0, ii = a.length; i < ii; i++) {
			if (Math.abs(a[i] - b[i]) > distance) {
				distance = Math.abs(a[i] - b[i]);
			}
		}
		return distance;
	}

	function parity(digit) {
		return isOdd(Math.round(digit[1] + digit[3]));
	}

	function drawGraphics() {
		elements.ctxg.strokeStyle = config.strokeColor;
		elements.ctxg.lineWidth = 3;
		elements.ctxg.beginPath();
		elements.ctxg.moveTo(dimensions.start, dimensions.height * 0.5);
		elements.ctxg.lineTo(dimensions.end, dimensions.height * 0.5);
		elements.ctxg.stroke();
	}

	return {
		init: init,
		setHandler: setHandler,
		config: config
	};

	// debugging utilities

	function drawBars(binary) {
		for (var i = 0, ii = binary.length; i < ii; i++) {
			if (binary[i] == 1) {
				elements.ctxg.strokeStyle = '#fff';
			} else {
				elements.ctxg.strokeStyle = '#000';
			}
			elements.ctxg.lineWidth = 3;
			elements.ctxg.beginPath();
			elements.ctxg.moveTo(start + i, height * 0.5);
			elements.ctxg.lineTo(start + i + 1, height * 0.5);
			elements.ctxg.stroke();
		}
	}

	function drawGraph(arr, arr1 = null) {
		// console.log(arr)
		elements.ctxGraph.clearRect(0, 0, 640, 480);
		let beginPosX = 10;
		let beginPosY = 300;

		elements.ctxGraph.beginPath();
		elements.ctxGraph.strokeStyle = 'rgb(0,0,0)'
		elements.ctxGraph.moveTo(beginPosX, beginPosY);

		for (let i = 0; i < arr.length; i++) {
			let Y = beginPosY - (255 - arr[i]);
			elements.ctxGraph.lineTo(beginPosX, Y)
			beginPosX += 1;

		}
		elements.ctxGraph.stroke();
		if (arr1 !== null) {
			elements.ctxGraph.beginPath();
			beginPosX = 10;
			beginPosY = 300;
			elements.ctxGraph.moveTo(beginPosX, beginPosY);
			elements.ctxGraph.strokeStyle = 'rgb(230,14,14)'
			for (let i = 0; i < arr1.length; i++) {
				let Y = beginPosY - (255 - arr1[i]);
				elements.ctxGraph.lineTo(beginPosX, Y)
				beginPosX += 1;
			}
			elements.ctxGraph.stroke();
		}
		// ctx.lineWidth = 1;
		// elements.ctxGraph.stroke();
	}
}();

