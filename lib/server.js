'use babel';

const child = require('child_process');
const carrier = require('carrier');

// A class for interacting with the Lean server protoccol.
class Server {
    constructor() {
        this.process = child.spawn("lean", ["--server"]);
        this.senders = [];

        carrier.carry(this.process.stdout, (line) => {
            let response = JSON.parse(line);
            this.getNextReceiver()(response);
        });

        this.process.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
            // throw "unhandled error"
        });

        this.process.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
    }

    getNextReceiver() {
        return this.senders.shift();
    }

    send(message, callback) {
        // console.log(message);
        let json = JSON.stringify(message);
        // console.log("about to send: " + json);
        this.process.stdin.write(json + "\n");
        this.senders.push(callback);
    }
};

export { Server };
