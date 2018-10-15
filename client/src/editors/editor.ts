import * as monaco from 'monaco-editor';
import * as Langs from '../definitions/languages'; 
import {h, VNode} from 'maquette';

function createMonaco(el, lang, source, rebind) {
  let ed = monaco.editor.create(el, {
    value: source,
    language: lang,
    scrollBeyondLastLine: false,
    theme:'vs',
    minimap: { enabled: false },
    overviewRulerLanes: 0,
    lineDecorationsWidth: "0ch",
    fontSize: 14,
    fontFamily: 'Monaco',
    lineNumbersMinChars: 2,
    lineHeight: 20,
    lineNumbers: "on",
    scrollbar: {
      verticalHasArrows: true,
      horizontalHasArrows: true,
      vertical: 'none',
      horizontal: 'none'
    }
  });    

  ed.createContextKey('alwaysTrue', true);
  ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
    let code = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF)
    rebind(code);
  }, 'alwaysTrue');
  return ed;
}

function createEditor(lang:string, source:string, cell:Langs.BlockState, context:Langs.EditorContext<any>) {
  let afterCreateHandler = (el) => { 
    let rebind = (code) => context.rebindSubsequent(cell, code)
    let ed = createMonaco(el, lang, source, rebind)

    let lastHeight = 100;
    let lastWidth = 0
    let resizeEditor = () => {
      let lines = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF, false).split('\n').length
      let height = lines > 4 ? lines * 20.0 : 80;
      let width = el.clientWidth

      if (height !== lastHeight || width !== lastWidth) {
        lastHeight = height
        lastWidth = width  
        ed.layout({width:width, height:height})
        el.style.height = height + "px"
      }
    }
    ed.getModel().onDidChangeContent(resizeEditor);
    window.addEventListener("resize", resizeEditor)
    setTimeout(resizeEditor, 100)
  }
  return h('div', { style: "height:100px; margin:20px 0px 10px 0px;", id: "editor_" + cell.editor.id.toString(), afterCreate:afterCreateHandler }, [ ])
}

export {
  createEditor
}