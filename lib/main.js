'use babel';

import { CompositeDisposable, Point, Range } from 'atom'
const path = require('path');
const child = require('child_process');

// A little bit of global state just to record whether we have initialized
// ourselves already.

var LEAN_SERVER = null;

function loadCustomCompletions() {
    let lean_completions =
        path.resolve(__dirname, '..', 'completions', 'completions.json');

    atom.config.set(
        "latex-completions.customAliases",
        lean_completions);
}

function ensureInitialized() {
    if (LEAN_SERVER === null) {
        require('atom-package-deps').install('language-lean').then(function() {
           loadCustomCompletions();
           LEAN_SERVER = lean.startServer();
        });
    }
}

function check() {
    return { command : "check" };
}

function sync(file_name, contents) {
    return {
        command : "sync",
        file_name : file_name,
        content : contents
    };
}

function complete(pattern, line) {
    return {
        command : "complete",
        pattern : pattern,
        line : line
    };
}

// {
//   type: string,
//   text?: string,
//   html?: string,
//   name?: string,  // Only specify this if you want the name to be something other than your linterProvider.name
//   filePath?: string,
//   range?: Range,
//   trace?: Array<Trace>,
//   fix?: Fix,
//   severity?: 'error' | 'warning' | 'info',
//   selected?: Function
// }

function severityToType(severity) {
    if (severity == "error") {
        return "Error";
    } else {
        return "Information";
    }
}

function toLint(message) {
    console.log("line: " + message["pos_line"]);
    console.log("col: " + message["pos_col"]);
    start_point = new Point(message["pos_line"] - 1, 0);
    end_point = new Point(message["pos_line"] - 1, message["pos_col"] - 1);
    let range = new Range(start_point, end_point);
    return {
      type: severityToType(message["severity"]),
      severity : message["severity"],
      filePath : message["file_name"],
      range : range,
      text: message["text"],
    };
}

function toSuggestion(completion) {
    let text = completion.text;
    let type = completion.type;
    return {
        text: text,
        type: type,
        description: "we should put something here",
    }
}

function handleComplete(resolve, reject, state, message) {
    var {
        editor,
        bufferPosition,
        scopeDescriptor,
        prefix,
        activatedManually } = state;
    console.log("completet");
    console.log(message);
    resolve([]);
}

const CompleteProvider = {
    getSuggestions: function(state) {
      return new Promise(function(resolve, reject) {
          var {
              editor,
              bufferPosition,
              scopeDescriptor,
              prefix,
              activatedManually } = state;

          LEAN_SERVER.send(complete(prefix, bufferPosition.row), function(message) {
              handleComplete(resolve, reject, state, message);
          });
      });
    },

    // This will work on JavaScript and CoffeeScript files, but not in js comments.
    selector: '.source.lean',
   // disableForSelector: '.source.js .comment'

   // This will take priority over the default provider, which has a priority of 0.
   // `excludeLowerPriority` will suppress any providers with a lower priority
   // i.e. The default provider will be suppressed
   inclusionPriority: 1,
   excludeLowerPriority: true
}

class Server {
    constructor() {
        this.process = child.spawn("lean", ["--server"]);
        this.senders = [];
        this.buffer = null;

        this.process.stdout.on('data', (data) => {
           console.log(`stdout: ${data}`);
           let lines = data.toString()
                           .split("\n");
           // Message fit in one data transmission, we can just dispatch to
           // the callback.
           if (lines.length === 2) {
               // Second line will be the empty string.
               let response = JSON.parse(lines[0]);
               this.getNextReceiver()(response);
           } else {
               throw "NYI";
           }
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
        console.log(message);
        let json = JSON.stringify(message);
        console.log("about to send: " + json);
        this.process.stdin.write(json + "\n");
        this.senders.push(callback);
    }
}

function handleSync(message) {
    console.log("sync");
    console.log(message);
}

function handleCheck(linter, response) {
    console.log("check");
    console.log(response);

    if (response.response === "ok") {
        if (response.messages) {
            linter.setMessages(response['messages'].map(toLint));
        } else {
            console.log("do not know how to handle message");
            console.log(response);
        }
    }
}

// This is your main singleton.
// The whole state of your package will be stored and managed here.
// let subscriptions
const lean = {
    startServer: function() {
        return new Server();
    },

    activate: function (state) {
        // subscriptions = new CompositeDisposable();
        try {
          ensureInitialized();

          atom.workspace.observeTextEditors((editor) => {
              // TODO(jroesch): A better way to do this?
              if (editor.getGrammar().name === "Lean") {
                // Not sure how to make this work well yet ...
                //   editor.onDidStopChanging(function() {
                //       let msg = sync(editor.getPath(), editor.getBuffer().getText());
                //       send(server, msg);
                //   });

                  editor.onDidSave(() => {
                      let msg = sync(editor.getPath(), editor.getBuffer().getText());

                      LEAN_SERVER.send(msg, (message) => {
                          handleSync(message);
                          LEAN_SERVER.send(check(), (message) => {
                              handleCheck(this.linter, message);
                          });
                      });
                  });
              }
          });
     } catch (err) {
         console.log("unhandled error: " + err);
     } finally {
        LEAN_SERVER = null;
     }
  },

  deactivate: function () {
    // When the user or Atom itself kills a window, this method is called.
    // subscriptions.dispose();
  },

  serialize: function () {
    // To save the current package's state, this method should return
    // an object containing all required data.
  },

  consumeLinter: function(indieRegistry) {
      this.linter = indieRegistry.register({name: 'Lean'})
      // this.subscriptions.add(myLinter)
  },

  provide: function() { return CompleteProvider; }
};

export default lean;
