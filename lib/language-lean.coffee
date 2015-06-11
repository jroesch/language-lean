LanguageLeanView = require './language-lean-view'
{CompositeDisposable} = require 'atom'

module.exports = LanguageLean =
  languageLeanView: null
  modalPanel: null
  subscriptions: null

  activate: (state) ->
    @languageLeanView = new LanguageLeanView(state.languageLeanViewState)
    @modalPanel = atom.workspace.addModalPanel(item: @languageLeanView.getElement(), visible: false)

    # Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    @subscriptions = new CompositeDisposable

    # Register command that toggles this view
    @subscriptions.add atom.commands.add 'atom-workspace', 'language-lean:toggle': => @toggle()

  deactivate: ->
    @modalPanel.destroy()
    @subscriptions.dispose()
    @languageLeanView.destroy()

  serialize: ->
    languageLeanViewState: @languageLeanView.serialize()

  toggle: ->
    console.log 'LanguageLean was toggled!'

    if @modalPanel.isVisible()
      @modalPanel.hide()
    else
      @modalPanel.show()
