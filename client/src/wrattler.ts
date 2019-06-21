/**
 * Is da best
 * 
 * @module Main
 */

/** This comment is needed so that TypeDoc parses the above one correctly */import * as Docs from './services/documentService'
import { Log } from "./common/log"
import { LanguagePlugins, loadNotebook, initializeCells } from './main'
import { markdownLanguagePlugin } from './languages/markdown'
import { javascriptLanguagePlugin } from './languages/javascript'
import { ExternalLanguagePlugin } from './languages/external'

/** @hidden */
declare var PYTHONSERVICE_URI: string;
/** @hidden */
declare var RSERVICE_URI: string;
/** @hidden */
declare var RACKETSERVICE_URI: string;

interface WrattlerNotebook {
  getDocumentContent() : string
  addDocumentContentChanged(handler:(newContent:string) => void) : void
}

class Wrattler {
  getDefaultLanguages() : LanguagePlugins {
    var languagePlugins : LanguagePlugins = { };
    let pyCode =  "# This is a python cell \n# py[ID] = pd.DataFrame({\"id\":[\"[ID]\"], \"language\":[\"python\"]})";
    let rCode = "# This is an R cell \n r[ID] <- data.frame(id = [ID], language =\"r\")";
    let rcCode = ";; This is a Racket cell [ID]\n";

    languagePlugins["markdown"] = markdownLanguagePlugin;
    languagePlugins["javascript"] = javascriptLanguagePlugin;
    languagePlugins["python"] = new ExternalLanguagePlugin("python", "fab fa-python", PYTHONSERVICE_URI, pyCode);
    languagePlugins["r"] = new ExternalLanguagePlugin("r", "fab fa-r-project", RSERVICE_URI, rCode);
    languagePlugins["racket"] = new ExternalLanguagePlugin("racket", "fa fa-question-circle", RACKETSERVICE_URI, rcCode);
    return languagePlugins;
  }

  async createNamedNotebook(elementID:string, languagePlugins:LanguagePlugins) : Promise<WrattlerNotebook> {
    return this.createNotebook(elementID, await Docs.getNamedDocumentContent(), languagePlugins);
  }

  async createNotebook(elementID:string, content:string, languagePlugins:LanguagePlugins) : Promise<WrattlerNotebook> {
    Log.trace("main", "Creating notebook for id '%s'", elementID)
    let documents = await Docs.getDocument(content);
    var {counter, editors} = loadNotebook(documents, languagePlugins);

    var currentContent = content;
    var handlers : ((newContent:string) => void)[] = [];
    function contentChanged(newContent:string) {
      currentContent = newContent;
      for(var h of handlers) h(currentContent);
    }

    initializeCells(elementID, counter, editors, languagePlugins, contentChanged);
    return {
      getDocumentContent : () => currentContent,
      addDocumentContentChanged : (h:(newContent:string) => void) => handlers.push(h)
    }
  }
}

(<any>window).wrattler = new Wrattler();
