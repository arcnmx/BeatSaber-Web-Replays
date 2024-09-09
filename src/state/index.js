/* global localStorage */
var utils = require('../utils');
var {queryParamTime} = require('../query-params');

const DAMAGE_DECAY = 0.25;
const DAMAGE_MAX = 10;

const DEBUG_CHALLENGE = {
	author: 'Superman',
	difficulty: 'Expert',
	id: '31',
	image: 'assets/img/molerat.jpg',
	songName: 'Friday',
	songSubName: 'Rebecca Black',
};

const emptyChallenge = {
	audio: '',
	author: '',
	difficulty: '',
	id: '',
	image: '',
	songName: '',
	songNameMedium: '',
	songNameShort: '',
	songSubName: '',
	songSubNameShort: '',
};

const emptyScore = {
	time: -1,
	accuracy: 0,
	beatsHit: 0,
	beatsMissed: 0,
	beatsText: '',
	combo: 0,
	maxCombo: 0,
	multiplier: 1,
	energy: 0.5,
	rank: '',
	score: 0,
	scoreDescription: '',
	misses: 0,
};

const isSafari = navigator.userAgent.toLowerCase().indexOf('safari') !== -1 && navigator.userAgent.toLowerCase().indexOf('chrome') === -1;

if (isSafari) {
	var module = require('../lib/oggdec');
	const decodeOggData = module().decodeOggData;
	const decodeAudioData = (data, completion) => {
		decodeOggData(data).then(completion);
	};
	(window.AudioContext || window.webkitAudioContext).prototype.decodeOggData = decodeAudioData;
}

let beatmaps;
let difficulties;

AFRAME.utils.extendDeep = function deepAssign(original, extension) {
	Object.keys(extension).forEach(key => {
		original[key] = extension[key];
	});

	return original;
};

/**
 * State handler.
 *
 * 1. `handlers` is an object of events that when emitted to the scene will run the handler.
 *
 * 2. The handler function modifies the state.
 *
 * 3. Entities and components that are `bind`ed automatically update:
 *    `bind__<componentName>="<propertyName>: some.item.in.state"`
 */
AFRAME.registerState({
	initialState: {
		activeHand: localStorage.getItem('hand') || 'right',
		challenge: Object.assign(
			{
				// Actively playing challenge.
				hasLoadError: false,
				isLoading: false,
				isBeatsPreloaded: false, // Whether we have passed the negative time.
				loadErrorText: '',
			},
			emptyChallenge
		),
		score: emptyScore,
		notes: null,
		replay: {
			isLoading: false,
			hasError: false,
			errorText: '',
		},
		player: {
			name: '',
			avatar: '',
		},
		controllerType: '',
		damage: 0,
		hasReceivedUserGesture: queryParamTime != 0,
		inVR: false,
		pov: false,
		isPaused: queryParamTime != 0, // Playing, but paused.
		isPlaying: false, // Actively playing.
		isFinished: false,
		isSafari: isSafari,
		isSongBufferProcessing: false,
		useractive: false,
		showControls: true,
		wrongMisses: 0,
		spawnRotation: 0,
		saberScale: new THREE.Vector3(1, 1, 1),
		saberGlowScale: new THREE.Vector3(1, 1.1, 1),
		settings: {headsetOpacity: 0, volume: 0.0},
		localReplay: !AFRAME.utils.getUrlParameter('id') && !AFRAME.utils.getUrlParameter('hash'),
		hiddenSaber: '',
	},

	handlers: {
		beatloaderpreloadfinish: state => {
			console.log("handlers.beatloaderpreloadfinish()");
			state.challenge.isBeatsPreloaded = true;
		},

		songFetched: (state, payload) => {
			console.log("handlers.songFetched()");
			state.challenge.image = payload.image;
			state.challenge.author = payload.metadata.levelAuthorName;

			state.challenge.songName = payload.metadata.songName;
			state.challenge.songNameShort = truncate(payload.metadata.songName, 18);
			state.challenge.songNameMedium = truncate(payload.metadata.songName, 30);

			state.challenge.songSubName = payload.metadata.songSubName || payload.metadata.songAuthorName;
			state.challenge.songSubNameShort = truncate(state.challenge.songSubName, 21);

			if (payload.leaderboardId) {
				state.challenge.leaderboardId = payload.leaderboardId;
			} else {
				state.challenge.id = payload.id;
			}

			document.title = `Replay | ${state.player.name} | ${payload.metadata.songName}`;
			document
				.querySelector('meta[property="og:title"]')
				.setAttribute('content', `Replay | ${state.player.name} | ${payload.metadata.songName}`);
		},

		challengeloadstart: (state, payload) => {
			console.log("handlers.challengeloadstart()");
			state.challenge.hasLoadError = false;
			state.challenge.isLoading = true;
		},

		challengeloadend: (state, payload) => {
			console.log("handlers.challengeloadend()");
			beatmaps = payload.beatmaps;
			difficulties = payload.difficulties;

			state.challenge.audio = payload.audio;

			const mode = payload.mode;
			state.challenge.mode = mode;
			state.challenge.difficulties = difficulties[mode];

			if (!state.challenge.difficulty || !payload.beatmaps[mode][state.challenge.difficulty]) {
				state.challenge.difficulty = payload.difficulty;
			}

			state.challenge.id = payload.isDragDrop ? '' : payload.id;

			state.challenge.songName = payload.info._songName;
			state.challenge.songNameShort = truncate(payload.info._songName, 18);
			state.challenge.songNameMedium = truncate(payload.info._songName, 30);

			state.challenge.songSubName = payload.info._songSubName || payload.info._songAuthorName;
			state.challenge.songSubNameShort = truncate(state.challenge.songSubName, 21);

			if (!state.challenge.image) {
				state.challenge.image = payload.image;
			}

			document.title = `Replay | ${state.player.name} | ${payload.info._songName}`;
			state.challenge.isLoading = false;
		},

		songstartaudio: (state, payload) => {
			console.log("handlers.songstartaudio()");
			navigator.mediaSession.metadata = new MediaMetadata({
				title: state.challenge.songName,
				artist: state.challenge.songSubName,
				album: state.player.name,
				artwork: [
					{
						src: state.challenge.image,
					},
				],
			});
		},

		replayloadstart: (state, payload) => {
			console.log("handlers.replayloadstart()");
			state.localReplay = false;
			state.replay.isLoading = true;
			state.replay.hasError = false;
			state.replay.errorText = null;
		},

		replayloaded: (state, payload) => {
			console.log("handlers.replayloaded()");
			state.replay.isLoading = false;
			state.notes = payload.notes;
			console.log(state.challenge);
			if (state.challenge.mode == 'OneSaber') {
				state.hiddenSaber = payload.leftHanded ? 'right' : 'left';
			}
		},

		replayloadfailed: (state, payload) => {
			console.log("handlers.replayloadfailed()");
			state.replay.isLoading = false;
			state.replay.hasError = true;
			state.replay.errorText = payload.error;
			state.localReplay = !AFRAME.utils.getUrlParameter('id') && !AFRAME.utils.getUrlParameter('hash');
		},

		userloaded: (state, payload) => {
			console.log("handlers.userloaded()");
			state.player = payload;

			document.title = `Replay | ${state.player.name} | ${state.challenge.songName}`;
			document
				.querySelector('meta[property="og:title"]')
				.setAttribute('content', `Replay | ${state.player.name} | ${state.challenge.songName}`);
		},

		challengeloaderror: (state, payload) => {
			console.log("handlers.challengeloaderror()");
			state.challenge.hasLoadError = true;
			state.challenge.isLoading = false;
			state.challenge.loadErrorText = `Map was not found. Drop or click to select zip locally`;
		},

		controllerconnected: (state, payload) => {
			console.log("handlers.controllerconnected()");
			state.controllerType = payload.name;
		},

		scoreChanged: (state, payload) => {
			console.log("handlers.scoreChanged()");
			updateScore(state, {index: payload.index}, false);
		},

		victory: function (state) {
			console.log("handlers.victory()");
			state.isVictory = true;

			// Percentage is score divided by total possible score.
			const accuracy = (state.score.score / (state.challenge.numBeats * 110)) * 100;
			state.score.accuracy = isNaN(accuracy) ? 0 : accuracy;
			state.score.score = isNaN(state.score.score) ? 0 : state.score.score;

			if (accuracy >= 95) {
				state.score.rank = 'S';
			} else if (accuracy >= 93) {
				state.score.rank = 'A';
			} else if (accuracy >= 90) {
				state.score.rank = 'A-';
			} else if (accuracy >= 88) {
				state.score.rank = 'B+';
			} else if (accuracy >= 83) {
				state.score.rank = 'B';
			} else if (accuracy >= 80) {
				state.score.rank = 'B-';
			} else if (accuracy >= 78) {
				state.score.rank = 'C+';
			} else if (accuracy >= 73) {
				state.score.rank = 'C';
			} else if (accuracy >= 70) {
				state.score.rank = 'C-';
			} else if (accuracy >= 60) {
				state.score.rank = 'D';
			} else {
				state.score.rank = 'F';
			}

			computeBeatsText(state);
		},

		victoryfake: function (state) {
			console.log("handlers.victoryfake()");
			state.score.accuracy = '74.99';
			state.score.rank = 'C';
		},

		wallhitstart: function (state) {
			console.log("handlers.wallhitstart()");
			takeDamage(state);
		},

		/**
		 * ?debugstate=loading
		 */
		debugloading: state => {
			console.log("handlers.debugloading()");
			DEBUG_CHALLENGE.id = '-1';
			Object.assign(state.challenge, DEBUG_CHALLENGE);
			state.challenge.isLoading = true;
		},

		difficultyselect: (state, payload) => {
			console.log("handlers.difficultyselect()");
			state.challenge.difficulty = payload;
			state.challenge.isBeatsPreloaded = false;
			state.isPaused = false;
			state.isFinished = false;
		},

		gamemenuresume: state => {
			console.log("handlers.gamemenuresume()");
			state.isPaused = false;
		},

		gamemenurestart: state => {
			console.log("handlers.gamemenurestart()");
			state.challenge.isBeatsPreloaded = false;
			state.isPaused = false;
			state.isFinished = false;
			state.isSongBufferProcessing = true;
			resetScore(state);
		},

		timechanged: (state, payload) => {
			console.log("handlers.timechanged()");
			state.isFinished = false;
			let notes = state.notes;
			for (var i = notes.length; --i > 0; ) {
				if (notes[i].time < payload.newTime) {
					updateScore(state, {index: i}, true);
					return;
				} else if (i == 1) {
					resetScore(state);
					return;
				}
			}

			state.score = emptyScore;
		},

		modeselect: (state, payload) => {
			console.log("handlers.modeselect()");
			state.challenge.mode = payload;
			state.challenge.isBeatsPreloaded = false;
			state.isPaused = false;
			state.isFinished = false;

			state.challenge.difficulties = difficulties[payload];
			state.challenge.difficulty = state.challenge.difficulties[0]._difficulty;
		},

		pausegame: state => {
			console.log("handlers.pausegame()");
			if (!state.isPlaying) {
				return;
			}
			state.isPaused = true;
		},

		finishgame: state => {
			console.log("handlers.finishgame()");
			if (!state.isPlaying) {
				return;
			}
			state.isPaused = true;
			state.isFinished = true;
		},

		songprocessingfinish: state => {
			console.log("handlers.songprocessingfinish()");
			state.isSongBufferProcessing = false;
		},

		songprocessingstart: state => {
			console.log("handlers.songprocessingstart()");
			state.isSongBufferProcessing = true;
		},

		usergesturereceive: state => {
			console.log("handlers.usergesturereceive()");
			state.hasReceivedUserGesture = true;
		},

		settingsChanged: (state, payload) => {
			console.log("handlers.settingsChanged()");
			state.settings = payload.settings;

			const saberScale = payload.settings.saberWidth / 100;

			state.saberScale = new THREE.Vector3(saberScale, 1, saberScale);
			state.saberGlowScale = new THREE.Vector3(saberScale, 1.1, saberScale);

			document.body.style.backgroundColor = payload.settings.backgroundColor;
		},

		povchanged: (state, payload) => {
			console.log("handlers.povchanged()");
			state.pov = payload.newPov;
		},

		useractive: (state, payload) => {
			console.log("handlers.useractive()");
			state.useractive = payload.isActive;
		},

		wrongMiss: (state, payload) => {
			console.log("handlers.wrongMiss()");
			state.wrongMisses++;
			console.log('Wrong miss #' + state.wrongMisses);
		},

		'enter-vr': state => {
			console.log("handlers.enter-vr()");
			state.inVR = true;
		},

		'exit-vr': state => {
			console.log("handlers.exit-vr()");
			state.inVR = false;
		},
	},

	/**
	 * Post-process the state after each action.
	 */
	computeState: (state, action, payload) => {
		state.isPlaying =
			!state.isPaused &&
			!state.isSongBufferProcessing &&
			!state.challenge.isLoading &&
			!state.replay.isLoading &&
			!state.challenge.hasLoadError &&
			!state.replay.hasError &&
			state.hasReceivedUserGesture &&
			!state.localReplay;

		state.showControls = state.useractive || !state.isPlaying;
	},
});

function truncate(str, length) {
	if (!str) {
		return '';
	}
	if (str.length >= length) {
		return str.substring(0, length - 2) + '..';
	}
	return str;
}

function updateScore(state, payload, force) {
	let note = state.notes[payload.index];

	if (note.time > state.score.time || force) {
		state.score.time = note.time;
		state.score.score = note.totalScore;
		state.score.scoreDescription = (note.totalScore + '').replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
		state.score.combo = note.combo;
		state.score.multiplier = note.multiplier;
		state.score.accuracy = note.accuracy.toFixed(2);
		state.score.fcAccuracy = note.fcAccuracy.toFixed(2);
		state.score.misses = note.misses;
		state.score.energy = note.energy;
		state.lastNoteTime = note.time;
	}

	// console.log(note.totalScore + " - " + note.index + " - " + note.i + " - " + note.time + " - " + payload.index + " - " + note.score);
}

function resetScore(state) {
	state.score.time = emptyScore.time;
	state.score.score = emptyScore.score;
	state.score.scoreDescription = emptyScore.scoreDescription;
	state.score.combo = emptyScore.combo;
	state.score.multiplier = emptyScore.multiplier;
	state.score.accuracy = emptyScore.accuracy;
	state.score.fcAccuracy = emptyScore.fcAccuracy;
	state.score.misses = emptyScore.misses;
	state.score.energy = emptyScore.energy;
	state.lastNoteTime = 0;
}
