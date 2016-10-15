'use babel';

const path = require('path');

// This is your main singleton.
// The whole state of your package will be stored and managed here.
const lean = {
  activate: function (state) {
      require('atom-package-deps').install('language-lean')
        .then(function() {
            console.log('All dependencies installed, good to go')
        });

      atom.config.set("language-lean.foo", 10);

      let lean_completions =
        path.resolve(__dirname, '..', 'completions', 'completions.json');

      atom.config.set(
          "latex-completions.customAliases",
          lean_completions);

      console.log("HERE!");
    // Activates and restores the previous session of your package.
  },
  deactivate: function () {
    // When the user or Atom itself kills a window, this method is called.
  },
  serialize: function () {
    // To save the current package's state, this method should return
    // an object containing all required data.
  }
};

export default lean;
