const {clamp} = require('./utils');
const {NoteEventType} = require('./open-replay-decoder');

function checkSS(file, isLink, completion) {
	if (isLink) {
		if (file.split('.').pop() == 'dat') {
			file = file.replace('https://cdn.discordapp.com/attachments/', 'https://discord.beatleader.pro/');
			var xhr = new XMLHttpRequest();
			xhr.open('GET', file, true);
			xhr.responseType = 'blob';

			xhr.onload = function () {
				if (xhr.status != 200) {
					completion({errorMessage: 'Sorry, this ScoreSaber replay is not available'});
				} else {
					checkSSFile(xhr.response, completion);
				}
			};
			xhr.onerror = event => {
				completion({errorMessage: 'Sorry, this ScoreSaber replay is not available'});
			};
			xhr.send();
		} else {
			completion({errorMessage: 'Wrong link format'});
		}
	} else {
		checkSSFile(file, completion);
	}
}

function checkSSFile(file, completion) {
	var reader = new FileReader();
	reader.onload = function (e) {
		decodeSS(e.target.result, completion);
	};
	reader.onerror = function (e) {
		// error occurred
		completion({errorMessage: 'Error: ' + e.type});
	};
	reader.readAsArrayBuffer(file);
}

// 1 = Easy, 3 = Normal, 5 = Hard, 7 = Expert, 9 = Expert+
const ssDifficultyNames = {
	'1': 'Easy',
	'3': 'Normal',
	'5': 'Hard',
	'7': 'Expert',
	'9': 'ExpertPlus',
};
function ssReplayToBSOR(ssReplay) {
	var result = {ssReplay: true, ssData: ssReplay};

	result.info = Object.assign({}, ssReplay.info);
	const difficulty = ssDifficultyNames[ssReplay.info.difficulty];
	if (difficulty !== undefined) {
		result.info.difficulty = difficulty;
	} else {
		result.info.difficulty = ssReplay.info.difficulty.toString();
	}
	result.info.modifiers = ssReplay.info.modifiers.join(', ');
	result.info.hash = ssReplay.info.hash.replace(/^custom_level_/,"");

	if (ssReplay.dynamicHeight) {
		result.heights = ssReplay.dynamicHeight.map(el => ({time: el.a, height: el.h}));
	}

	result.notes = [];
	result.walls = [];
	const newDecode = false;
	if (newDecode) {
		ssReplay.hits.forEach((ssnote, i) => {
			var note = {};
			note.noteID = ssnote.noteData.lineIndex * 1000 + ssnote.noteData.noteLineLayer * 100 + ssnote.noteData.colorType * 10 + ssnote.noteData.cutDirection;
			note.eventTime = ssnote.songTime;
			note.spawnTime = i;
		// TODO: ssnote..timeScale = DecodeFloat(dataView);
			// TODO: ssnote.timeScale2 = DecodeFloat(dataView);

			switch (ssnote.type) {
				case SomethingType.good:
					note.eventType = NoteEventType.good;
					note.noteCutInfo = {
						beforeCutRating: ssnote.beforeCutRating,
						afterCutRating: ssnote.afterCutRating,
						cutDistanceToCenter: ssnote.cutDistanceToCenter,
						timeDeviation: ssnote.songTime - ssnote.noteData.songTime,
						cutPoint: ssnote.cutPoint,
						cutNormal: ssnote.cutNormal,
						saberDir: ssnote.saberDir,
						saberType: ssnote.saberType,
						directionOK: ssnote.directionOK,
						saberSpeed: ssnote.saberSpeed,
						cutAngle: ssnote.cutAngle,
						cutDirDeviation: ssnote.cutDirDeviation,
						//speedOK: true,
						//saberTypeOK: true,
						//wasCutTooSoon: false,
					};
					break;
				case SomethingType.bad:
					note.eventType = NoteEventType.bad;
					break;
				case SomethingType.miss:
					note.eventType = NoteEventType.miss;
					break;
				case SomethingType.bomb:
					note.eventType = NoteEventType.bomb;
					break;
				default:
					console.error('unknown ss note type', ssnote.type);
					return;
			}
			result.notes.push(note);
		});
		ssReplay.walls.forEach((sswall, i) => {
			const wall = {
				time: sswall.songTime,
			};
			result.walls.push(wall);
		});
	} else
	ssReplay.scores.forEach((score, i) => {
		if (i < ssReplay.noteInfos.length) {
			var note = {};
			const info = ssReplay.noteInfos[i];
			var noteType = parseInt(info[3]);
			if (isNaN(noteType)) {
				noteType = 3;
			}
			note.noteID = parseInt(info[0]) * 1000 + parseInt(info[1]) * 100 + noteType * 10 + parseInt(info[2]);
			note.eventTime = ssReplay.noteTime[i];
			note.spawnTime = i;
			note.eventType = score > 0 ? NoteEventType.good : (score + 1) * -1;
			if (note.eventType == NoteEventType.good) {
				note.noteCutInfo = {
					beforeCutRating: ssReplay.hits[i].beforeCutRating, //clamp(score / 70.0, 0.0, 1.0),
					afterCutRating: ssReplay.hits[i].afterCutRating,//clamp((score -= 70) / 30.0, 0.0, 1.0),
					cutDistanceToCenter: ssReplay.hits[i].cutDistanceToCenter,//0.3 - clamp((score -= 30) / 15.0, 0.0, 1.0) * 0.3,
				};
			}
			result.notes.push(note);
		} else {
			var wall = {};
			wall.time = ssReplay.noteTime[i];
			result.walls.push(wall);
		}
	});
	result.frames = ssReplay.frames;
	result.frames.forEach(frame => {
		frame.time = frame.a;
		frame.fps = frame.i;
	});

	return result;
}

function decodeSS(arrayBuffer, completion) {
	decompressSS(arrayBuffer, result => {
		if (result.errorMessage !== undefined) {
			completion(result);
		} else {
			const dataView = new DataView(new Uint8Array(result).buffer);
			dataView.pointer = 0;
			completion(decodeSSPayload(dataView));
		}
	})
}

function decompressSS(arrayBuffer, completion) {
	var bytes = new TextEncoder().encode('ScoreSaber Replay \uD83D\uDC4C\uD83E\uDD20\r\n');
	var sourceIndex = bytes.length;
	var start = new Int8Array(arrayBuffer.slice(0, sourceIndex));
	var flag = false;

	for (var index = 0; index < sourceIndex - 12 && start[index] === bytes[index]; ++index) {
		if (index === sourceIndex - 19) {
			flag = true;
		}
	}

	if (!flag) {
		completion({errorMessage: 'Old SS replays are not supported'});
		return;
	}

	/*const lzma_min = '/vendor/lzma-min';
	const LZMA = require(lzma_min);
	const worker = 'vendor/lzma_worker.js';*/
	var my_lzma = new LZMA.LZMA(worker);
	var data = new Uint8Array(arrayBuffer.slice(sourceIndex));

	my_lzma.decompress(
		data,
		(result, error) => {
			if (result) {
				completion(result);
			} else {
				completion({errorMessage: "Can't unzip the replay"});
			}
		},
		percent => {
			//console.log(percent);
		}
	);
}

const SomethingType = {
	good: 1,
	bad: 2,
	miss: 3,
	bomb: 4,
}

// WARNING
// Attrocious code. It's reverse engineered code
// I'm just copying now spending as little time as I can
// to save $15/month on server

// Want to improve it? Feel free to do that!
// I'll spend as little time on SS support as I can.
function decodeSSPayload(dataView) {
	const offsets = decodeOffsets(dataView);

	var info = decodeInfo(dataView, offsets.replayInfo);
	const frames = decodeFrames(dataView, offsets.zcYpPUYq3RAHg);
	const automaticHeight = decodeFFArray(dataView, offsets.zJbk_r2VWJKCY);
	var thirdArray = decodeThirdArray(dataView, offsets.zuWYxiBCiOOO);
	const fourthArray = decodeIAFArray(dataView, offsets.zWVthFsNiRgp);
	const fifthArray = decodeIAFArray(dataView, offsets.zjjCMbAVve_UJ);

	info.totalScore = fourthArray[fourthArray.length - 1].i;

	var result = {};
	result.info = info;
	result.frames = frames;
	result.dynamicHeight = automaticHeight;
	result.scores = [];
	result.combos = [];
	result.noteTime = [];
	result.noteInfos = [];
	var intAndFloatList = fifthArray;
	for (var index1 = fifthArray.length - 1; index1 >= 0; --index1) {
		for (var index2 = 0; index2 < thirdArray.length; ++index2) {
			if (thirdArray[index2].songTime == fifthArray[index1].a && thirdArray[index2].combo == -1) {
				thirdArray[index2].combo = fifthArray[index1].i;
				intAndFloatList.splice(index1, 1);
				break;
			}
		}
	}
	var num1 = 0.0;
	var num2 = 0;
	for (var index = 0; index < thirdArray.length; ++index) {
		if (thirdArray[index].combo == -1) thirdArray[index].combo = num2;
		else if (thirdArray[index].songTime > num1) {
			num2 = thirdArray[index].combo;
			num1 = thirdArray[index].songTime;
		}
	}
	thirdArray = thirdArray.sort(function (a, b) {
		if (a.noteData.songTime < b.noteData.songTime) return -1;
		if (a.noteData.songTime > b.noteData.songTime) return 1;
		return 0;
	});
	result.hits = [];
	for (var index = 0; index < thirdArray.length; ++index) {
		var somethingBig = thirdArray[index];
		result.hits.push(somethingBig);
		var num3 = Math.round(70 * somethingBig.beforeCutRating);
		var num4 = Math.round(30 * somethingBig.afterCutRating);
		var num5 = Math.round(15 * (1 - clamp(somethingBig.cutDistanceToCenter / 0.3, 0, 1)));
		if (somethingBig.type == 1) result.scores.push(num3 + num4 + num5);
		else result.scores.push(-somethingBig.type);
		result.combos.push(somethingBig.combo >= 0 ? somethingBig.combo : 1);
		result.noteTime.push(somethingBig.songTime);
		result.noteInfos.push(
			'' +
				somethingBig.noteData.lineIndex +
				somethingBig.noteData.noteLineLayer +
				somethingBig.noteData.cutDirection +
				somethingBig.noteData.colorType
		);
	}
	result.walls = [];
	for (var index = 0; index < intAndFloatList.length; ++index) {
		result.walls.push({
			songTime: intAndFloatList[index].a,
			combo: intAndFloatList[index].i,
		})
		result.scores.push(-5);
		result.combos.push(intAndFloatList[index].i);
		result.noteTime.push(intAndFloatList[index].a);
	}

	return ssReplayToBSOR(result);
}

function decodeOffsets(dataView) {
	var result = {};
	result.replayInfo = DecodeInt(dataView);
	result.zcYpPUYq3RAHg = DecodeInt(dataView);
	result.zJbk_r2VWJKCY = DecodeInt(dataView);
	result.zuWYxiBCiOOO = DecodeInt(dataView);
	result.zWVthFsNiRgp = DecodeInt(dataView);
	result.zjjCMbAVve_UJ = DecodeInt(dataView);
	result.zVWDENm4dsje6Q2VyAc0ji18 = DecodeInt(dataView);
	result.zKQ4Y1J0ZmL3z7FdHXw = DecodeInt(dataView);
	result.zXAxGrPnBYXhi = DecodeInt(dataView);
	return result;
}

function decodeInfo(dataView, offset) {
	var replayInfoo = {};
	dataView.pointer = offset;
	replayInfoo.version = DecodeString(dataView);
	replayInfoo.hash = DecodeString(dataView);
	replayInfoo.difficulty = DecodeInt(dataView);
	replayInfoo.mode = DecodeString(dataView);
	replayInfoo.environment = DecodeString(dataView);
	replayInfoo.modifiers = DecodeStringArray(dataView);
	replayInfoo.noteJumpStartBeatOffset = DecodeFloat(dataView);
	replayInfoo.leftHanded = DecodeBool(dataView);
	replayInfoo.height = DecodeFloat(dataView);
	replayInfoo.rr = DecodeFloat(dataView);
	replayInfoo.room = decodeHZ1(dataView);
	replayInfoo.st = DecodeFloat(dataView);

	return replayInfoo;
}

function decodeHZ1(dataView) {
	var result = {};
	result.x = DecodeFloat(dataView);
	result.y = DecodeFloat(dataView);
	result.z = DecodeFloat(dataView);
	return result;
}

function decodeFrames(dataView, offset) {
	dataView.pointer = offset;
	var num = DecodeInt(dataView);
	var frameList = [];
	for (var index = 0; index < num; ++index) frameList.push(DecodeFrame(dataView));
	return frameList;
}

function DecodeFrame(dataView) {
	var result = {};
	result.head = Decode34(dataView);
	result.left = Decode34(dataView);
	result.right = Decode34(dataView);
	result.i = DecodeInt(dataView);
	result.a = DecodeFloat(dataView);
	return result;
}

function Decode34(dataView) {
	var result = {};
	result.position = Decode3(dataView);
	result.rotation = Decode4(dataView);
	return result;
}

function Decode3(dataView) {
	var result = {};
	result.x = DecodeFloat(dataView);
	result.y = DecodeFloat(dataView);
	result.z = DecodeFloat(dataView);
	return result;
}

function Decode4(dataView) {
	var result = {};
	result.x = DecodeFloat(dataView);
	result.y = DecodeFloat(dataView);
	result.z = DecodeFloat(dataView);
	result.w = DecodeFloat(dataView);
	return result;
}

function decodeFFArray(dataView, offset) {
	dataView.pointer = offset;
	var num = DecodeInt(dataView);
	var twoFloatList = [];
	for (var index = 0; index < num; ++index) twoFloatList.push(Decode2(dataView));
	return twoFloatList;
}

function Decode2(dataView) {
	var result = {};
	result.h = DecodeFloat(dataView);
	result.a = DecodeFloat(dataView);
	return result;
}

function DecodeDK(dataView) {
	var result = {};
	result.songTime = DecodeFloat(dataView);
	result.noteLineLayer = DecodeInt(dataView);
	result.lineIndex = DecodeInt(dataView);
	result.colorType = DecodeInt(dataView);
	result.cutDirection = DecodeInt(dataView);
	return result;
}

function decodeThirdArray(dataView, offset) {
	dataView.pointer = offset;
	var num = DecodeInt(dataView);
	var somethingBigList = [];
	for (var index = 0; index < num; ++index) somethingBigList.push(DecodeSomethingBig(dataView));
	return somethingBigList;
}

function DecodeSomethingBig(dataView) {
	var result = {};
	result.noteData = DecodeDK(dataView);
	result.type = DecodeInt(dataView);
	result.cutPoint = Decode3(dataView);
	result.cutNormal = Decode3(dataView);
	result.saberDir = Decode3(dataView);
	result.saberType = DecodeInt(dataView);
	result.directionOK = DecodeBool(dataView);
	result.saberSpeed = DecodeFloat(dataView);
	result.cutAngle = DecodeFloat(dataView);
	result.cutDistanceToCenter = DecodeFloat(dataView);
	result.cutDirDeviation = DecodeFloat(dataView);
	result.beforeCutRating = DecodeFloat(dataView);
	result.afterCutRating = DecodeFloat(dataView);
	result.songTime = DecodeFloat(dataView);
	result.timeScale = DecodeFloat(dataView);
	result.timeScale2 = DecodeFloat(dataView);
	result.combo = -1;

	return result;
}

function decodeIAFArray(dataView, offset) {
	dataView.pointer = offset;
	var num = DecodeInt(dataView);
	if (num > 10000) {
		num = 1;
	}
	var intAndFloatList = [];
	for (var index = 0; index < num; ++index)
		intAndFloatList.push({
			i: DecodeInt(dataView),
			a: DecodeFloat(dataView),
		});
	return intAndFloatList;
}

function DecodeInt(dataView) {
	const result = dataView.getInt32(dataView.pointer, true);
	dataView.pointer += 4;
	return result;
}

function DecodeUint8(dataView) {
	const result = dataView.getUint8(dataView.pointer, true);
	dataView.pointer++;
	return result;
}

function DecodeStringArray(dataView) {
	var length = DecodeInt(dataView);
	var strArray = [];
	for (var index = 0; index < length; ++index) strArray.push(DecodeString(dataView));
	return strArray;
}

function DecodeString(dataView) {
	const length = dataView.getInt32(dataView.pointer, true);
	if (length < 0 || length > 1000) {
		dataView.pointer += 1;
		return DecodeString(dataView);
	}
	var enc = new TextDecoder('utf-8');
	const string = enc.decode(new Int8Array(dataView.buffer.slice(dataView.pointer + 4, length + dataView.pointer + 4)));
	dataView.pointer += length + 4;
	return string;
}

function DecodeFloat(dataView) {
	const result = dataView.getFloat32(dataView.pointer, true);
	dataView.pointer += 4;
	return result;
}

function DecodeBool(dataView) {
	const result = dataView.getUint8(dataView.pointer, true) != 0;
	dataView.pointer++;
	return result;
}

module.exports.checkSS = checkSS;
module.exports.decodeSS = decodeSS;
module.exports.decodeSSPayload = decodeSSPayload;
module.exports.decompressSS = decompressSS;
