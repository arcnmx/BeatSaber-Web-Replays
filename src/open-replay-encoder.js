const { StructType, NoteEventType } = require('./open-replay-decoder');

function encodeBSOR(arrayBuffer, replay) {
	const dataView = new DataView(arrayBuffer);
	dataView.pointer = 0;

	EncodeInt(dataView, 0x442d3d69);
	EncodeInt(dataView, 1);

	EncodeUint8(dataView, StructType.info);
	EncodeInfo(dataView, replay.info);

	EncodeUint8(dataView, StructType.frames);
	EncodeFrames(dataView, replay.frames);

	EncodeUint8(dataView, StructType.notes);
	EncodeNotes(dataView, replay.notes);

	EncodeUint8(dataView, StructType.walls);
	EncodeWalls(dataView, replay.walls);

	EncodeUint8(dataView, StructType.heights);
	EncodeHeights(dataView, replay.heights);

	EncodeUint8(dataView, StructType.pauses);
	EncodePauses(dataView, replay.pauses || []);

	return dataView.pointer;
}

function EncodeInfo(dataView, info) {
	EncodeString(dataView, info.version);
	EncodeString(dataView, info.gameVersion);
	EncodeString(dataView, info.timestamp);

	EncodeString(dataView, info.playerID);
	EncodeName(dataView, info.playerName);
	EncodeString(dataView, info.platform);

	EncodeString(dataView, info.trackingSystem);
	EncodeString(dataView, info.hmd);
	EncodeString(dataView, info.controller);

	EncodeString(dataView, info.hash);
	EncodeString(dataView, info.songName);
	EncodeString(dataView, info.mapper);
	EncodeString(dataView, info.difficulty);

	EncodeInt(dataView, info.score);
	EncodeString(dataView, info.mode);
	EncodeString(dataView, info.environment);
	EncodeString(dataView, info.modifiers);
	EncodeFloat(dataView, info.jumpDistance);
	EncodeBool(dataView, info.leftHanded);
	EncodeFloat(dataView, info.height);

	EncodeFloat(dataView, info.startTime);
	EncodeFloat(dataView, info.failTime);
	EncodeFloat(dataView, info.speed);
}

function EncodeFrames(dataView, frames) {
	EncodeInt(dataView, frames.length);
	for (const frame of frames) {
		EncodeFrame(dataView, frame);
	}
}

function EncodeFrame(dataView, frame) {
	EncodeFloat(dataView, frame.time);
	EncodeInt(dataView, frame.fps);
	EncodeEuler(dataView, frame.head);
	EncodeEuler(dataView, frame.left);
	EncodeEuler(dataView, frame.right);
}

function EncodeNotes(dataView, notes) {
	EncodeInt(dataView, notes.length);
	for (const note of notes) {
		EncodeNote(dataView, note);
	}
}

function EncodeWalls(dataView, walls) {
	EncodeInt(dataView, walls.length);
	for (const wall of walls) {
		EncodeWall(dataView, wall);
	}
}

function EncodeWall(dataView, wall) {
	EncodeInt(dataView, wall.wallID);
	EncodeFloat(dataView, wall.energy);
	EncodeFloat(dataView, wall.time);
	EncodeFloat(dataView, wall.spawnTime);
}

function EncodeHeights(dataView, heights) {
	EncodeInt(dataView, heights.length);
	for (const height of heights) {
		EncodeHeight(dataView, height);
	}
}

function EncodeHeight(dataView, height) {
	EncodeFloat(dataView, height.height);
	EncodeFloat(dataView, height.time);
}

function EncodePauses(dataView, pauses) {
	EncodeInt(dataView, pauses.length);
	for (const pause of pauses) {
		EncodePause(dataView, pause);
	}
}

function EncodePause(dataView, pause) {
	EncodeLong(dataView, pause.duration);
	EncodeFloat(dataView, pause.time);
}

const fallbackCutInfo = {
	speedOK: true,
	directionOK: true,
	saberTypeOK: true,
	wasCutTooSoon: false,
	saberSpeed: 0.0,
	saberDir: { x: 0.0, y: 0.0, z: 0.0 },
	saberType: 0,
	timeDeviation: 0.0,
	cutDirDeviation: 0.0,
	cutPoint: { x: 0.0, y: 0.0, z: 0.0 },
	cutNormal: { x: 0.0, y: 0.0, z: 0.0 },
	cutDistanceToCenter: 0.0,
	cutAngle: 0.0,
	beforeCutRating: 0.0,
	afterCutRating: 0.0,
};

function EncodeNote(dataView, note) {
	EncodeInt(dataView, note.noteID);
	EncodeFloat(dataView, note.eventTime);
	EncodeFloat(dataView, note.spawnTime);
	EncodeInt(dataView, note.eventType);
	if (note.eventType == NoteEventType.good || note.eventType == NoteEventType.bad) {
		EncodeCutInfo(dataView, Object.assign(Object.assign({}, fallbackCutInfo), note.noteCutInfo || {}));
	}
}

function EncodeCutInfo(dataView, cutInfo) {
	EncodeBool(dataView, cutInfo.speedOK);
	EncodeBool(dataView, cutInfo.directionOK);
	EncodeBool(dataView, cutInfo.saberTypeOK);
	EncodeBool(dataView, cutInfo.wasCutTooSoon);
	EncodeFloat(dataView, cutInfo.saberSpeed);
	EncodeVector3(dataView, cutInfo.saberDir);
	EncodeInt(dataView, cutInfo.saberType);
	EncodeFloat(dataView, cutInfo.timeDeviation);
	EncodeFloat(dataView, cutInfo.cutDirDeviation);
	EncodeVector3(dataView, cutInfo.cutPoint);
	EncodeVector3(dataView, cutInfo.cutNormal);
	EncodeFloat(dataView, cutInfo.cutDistanceToCenter);
	EncodeFloat(dataView, cutInfo.cutAngle);
	EncodeFloat(dataView, cutInfo.beforeCutRating);
	EncodeFloat(dataView, cutInfo.afterCutRating);
}

function EncodeEuler(dataView, euler) {
	EncodeVector3(dataView, euler.position);
	EncodeQuaternion(dataView, euler.rotation);
}

function EncodeVector3(dataView, vector) {
	EncodeFloat(dataView, vector.x);
	EncodeFloat(dataView, vector.y);
	EncodeFloat(dataView, vector.z);
}

function EncodeQuaternion(dataView, quat) {
	EncodeFloat(dataView, quat.x);
	EncodeFloat(dataView, quat.y);
	EncodeFloat(dataView, quat.z);
	EncodeFloat(dataView, quat.w);
}

function EncodeLong(dataView, value) {
	dataView.setBigInt64(dataView.pointer, value, true);
	dataView.pointer += 8;
}

function EncodeInt(dataView, value) {
	dataView.setInt32(dataView.pointer, value, true);
	dataView.pointer += 4;
}

function EncodeUint8(dataView, value) {
	dataView.setUint8(dataView.pointer, value, true);
	dataView.pointer++;
}

function EncodeString(dataView, value) {
	if (value === undefined) {
		return EncodeString(dataView, "");
	}
	const enc = new TextEncoder('utf-8');
	const { written } = enc.encodeInto(value, new Uint8Array(dataView.buffer, dataView.pointer + 4));
	if (written > 300) {
		throw new Error("EncodeString too long? " + value);
	}
	dataView.setInt32(dataView.pointer, written, true);
	dataView.pointer += 4 + written;
}

function EncodeName(dataView, value) {
	return EncodeString(dataView, value);
	// TODO: what is this doing?
	/*const length = dataView.getInt32(dataView.pointer, true);
	let lengthOffset = 0;
	if (length > 0) {
		while (
			dataView.getInt32(length + dataView.pointer + 4 + lengthOffset, true) != 6 &&
			dataView.getInt32(length + dataView.pointer + 4 + lengthOffset, true) != 5 &&
			dataView.getInt32(length + dataView.pointer + 4 + lengthOffset, true) != 8
		) {
			lengthOffset++;
		}
	}
	const string = enc.decode(new Int8Array(dataView.buffer.slice(dataView.pointer + 4, length + dataView.pointer + 4 + lengthOffset)));
	dataView.pointer += length + 4 + lengthOffset;*/
}

function EncodeFloat(dataView, value) {
	if (value === undefined) {
		return EncodeFloat(dataView, 0.0);
	}
	dataView.setFloat32(dataView.pointer, value, true);
	dataView.pointer += 4;
}

function EncodeBool(dataView, value) {
	dataView.setUint8(dataView.pointer, value ? 1 : 0, true) != 0;
	dataView.pointer++;
}

module.exports.encodeBSOR = encodeBSOR;
