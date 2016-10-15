'use babel';

import { CompositeDisposable, Point, Range } from 'atom'
const path = require('path');
const child = require('child_process');

// A little bit of global state just to record whether we have initialized
// ourselves already.

var LEAN_SERVER = false;

function loadCustomCompletions() {
    let lean_completions =
        path.resolve(__dirname, '..', 'completions', 'completions.json');

    atom.config.set(
        "latex-completions.customAliases",
        lean_completions);
}

function ensureInitialized() {
    if (!LEAN_SERVER) {
        require('atom-package-deps').install('language-lean').then(function() {
           console.log('All dependencies installed, good to go');
           loadCustomCompletions();
        });
        LEAN_SERVER = true;
    }
}

function send(server, msg) {
    let json = JSON.stringify(msg);
    console.log("about to send: " + json);
    server.stdin.write(json + "\n");
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

const CompleteProvider = {
    getSuggestions: function(state) {
    //{editor, bufferPosition, scopeDescriptor, prefix, activatedManually}
      return new Promise(function(resolve) {
          resolve([{ text: 'something' }]);
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

// This is your main singleton.
// The whole state of your package will be stored and managed here.
// let subscriptions
const lean = {
    startServer: function() {
        const lean = child.spawn("lean", ["--server"]);

        lean.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
            console.log(data.toString());
            let lints = [];
            data.toString().split("\n").forEach((line) => {
                if (line !== "") {
                    let response = JSON.parse(line);
                    if (response["is_ok"] !== undefined) {
                        response['messages'].forEach((msg) => {
                            lints.push(msg);
                        });
                    } else {
                         console.log("do not know how to handle message");
                         console.log(response);
                    }
                }
            });
            this.linter.setMessages(lints.map(toLint));
        });

        lean.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
            // throw "unhandled error"
        });

        lean.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

        return lean;
  },

  activate: function (state) {
      // subscriptions = new CompositeDisposable();
      try {
          ensureInitialized();
          server = this.startServer();
          this.provider = new CompleteProvider();

          atom.workspace.observeTextEditors((editor) => {
              // TODO(jroesch): A better way to do this?
              if (editor.getGrammar().name === "Lean") {
                // Not sure how to make this work well yet ...
                //   editor.onDidStopChanging(function() {
                //       let msg = sync(editor.getPath(), editor.getBuffer().getText());
                //       send(server, msg);
                //   });

                  editor.onDidSave(function() {
                      let msg = sync(editor.getPath(), editor.getBuffer().getText());
                      send(server, msg);
                      send(server, check());
                  });
              }
          });
     } catch (err) {
         console.log("unhandled error: " + err);
     } finally {
        LEAN_SERVER = false;
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
