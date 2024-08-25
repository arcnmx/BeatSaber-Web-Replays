const { decodeSS, decodeSSPayload } = require('../src/ss-replay-decoder');
const { decodeBSOR } = require('../src/open-replay-decoder');
const { encodeBSOR } = require('../src/open-replay-encoder');
const fs = require('node:fs');
const { basename } = require('node:path');
const { argv, stdout } = require('node:process');

// override read path (stdin or otherwise)
var dataPath;

class FileReader {
	constructor() {
		this.onload = undefined;
		this.onerror = undefined;
	}

	readAsArrayBuffer(path) {
		const callback = (err, buffer) => {
			if (err) {
				if (this.onerror !== undefined) {
					this.onerror(err);
				}
				return;
			}
			if (this.onload !== undefined) {
				this.onload({target: { result: buffer }});
			}
		};
		if (dataPath === "-") {
			this.onerror("TODO: read from stdin");
		} else {
			fs.readFile(dataPath !== undefined ? dataPath : path, callback);
		}
	}
}
global.FileReader = FileReader;

const path = argv[2];

if (argv[3] !== undefined) {
	dataPath = argv[3];
}

const handler = data => {
	if (data.errorMessage !== undefined) {
		console.error(data.errorMessage);
		return;
	}

	const replay = data;
	if (replay.info.playerID === undefined) {
		const filename = basename(path);
		const found = filename.match(/^(\d+)-/);
		if (found !== null) {
			replay.info.playerID = found[1];
		}
	}
	console.error(replay);
	// TODO: calculate beforehand
	const buffer = new ArrayBuffer(1024 * 1024 * 8);
	const bsorLen = encodeBSOR(buffer, replay);
	const bsor = buffer.slice(0, bsorLen);
	const reparsed = decodeBSOR(bsor);
	console.error("re-decoded: ", reparsed);
	stdout.write(new DataView(bsor));
};

fs.readFile(dataPath !== undefined ? dataPath : path, (err, buffer) => {
	if (err) {
		console.error(err);
		return;
	}

	decodeSS(buffer, res => {
		if (res.errorMessage === 'Old SS replays are not supported') {
			// assume this is a decompressed payload via `tail -c +29 | xz --format=lzma -cd`
			// (worthwhile alternative to using the slow js lzma implementation)
			const dataView = new DataView(new Uint8Array(buffer).buffer);
			dataView.pointer = 0;
			handler(decodeSSPayload(dataView));
			return;
		}

		handler(res);
	});
});
