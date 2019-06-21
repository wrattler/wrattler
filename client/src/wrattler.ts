/**
 * Wrattler can run as a stand-alone system or as a JupyterLab extension.
 * It is also possible to create new instance of Wrattler inside any web page
 * (provided that you give it URLs for all the services it needs). This 
 * module is the main entry point if you want to manage Wrattler notebook 
 * instances on your own.
 * 
 * - This module exports the [Wrattler](../classes/main.wrattler.html) class.
 *   When loaded, it also sets `window.wrattler` to a new instance of the class
 *   so that it is easier to use it inside web projects as a stand-alone JS file.
 *   The class provides methods for configuring language plugins  
 *   ([`LanguagePlugins`](../modules/main.html#languageplugins) type) and 
 *   creating notebooks.
 * 
 * - [WrattlerNotebook](../interfaces/main.wrattlernotebook.html) interface 
 *   represents a created notebook. It provides methods for accessing document
 *   contents and lets you register handler that is triggered whenever the user
 *   makes a change in a notebook.
 * 
 * @module Main
 */

/** This comment is needed so that TypeDoc parses the above one correctly */import * as Docs from './services/documentService'
import * as Langs from './definitions/languages'
import { Log } from "./common/log"
import { loadNotebook, initializeCells } from './main'
import { markdownLanguagePlugin } from './languages/markdown'
import { javascriptLanguagePlugin } from './languages/javascript'
import { ExternalLanguagePlugin } from './languages/external'

/** @hidden */
declare var PYTHONSERVICE_URI: string;
/** @hidden */
declare var RSERVICE_URI: string;
/** @hidden */
declare var RACKETSERVICE_URI: string;

/** 
 * Represents a created Wrattler notebook. The interface provides access to the 
 * notebook contents. You can obtain the current contents and get notified when
 * it changes.
 */
interface WrattlerNotebook {
  /** Returns the current contents of a notebook as one Markdown string. */
  getDocumentContent() : string
  /** Registers a handler which will be triggered whenever the contents of a notebook changes. */
  addDocumentContentChanged(handler:(newContent:string) => void) : void
}

/** 
 * A dictionary that associates a language plugin with a language name.
 */
type LanguagePlugins = { [lang:string] : Langs.LanguagePlugin }

/**
 * Main entry point that can be used for creating new Wrattler notebook instances.
 * You can use `getDefaultLanguages` to get default language plugins implemented 
 * in core Wrattler and `createNotebook` to create a new notebook instance.
 */
class Wrattler {
  /** Creates a new `LanguagePlugin` instance which delegates binding and evaluation
   * to a specified langauge service. You can pass the returned `LanguagePlugin` to
   * the `createNotebook` function to get a notebook supporting this langauge.  */
  createExternalLanguagePlugin(language, serviceUrl:string, faClass?:string, defaultCode?:string) {
    return new ExternalLanguagePlugin(language, faClass?faClass:"fa fa-question-circle", serviceUrl, defaultCode?defaultCode:"");
  }

  /** Returns default language plugins for Markdown, JavaScript, R, Python and Racket   */
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

  /**
   * Creates a Wrattler notebook that loads notebooks automatically by requesting the `index.md` 
   * URL from the domain where it is hosted (or `another.md` when the current URl contains `?another` in the query string).
   */
  async createNamedNotebook(elementID:string, languagePlugins:LanguagePlugins) : Promise<WrattlerNotebook> {
    return this.createNotebook(elementID, await Docs.getNamedDocumentContent(), languagePlugins);
  }

  /**
   * Given initial Markdown source code and a dictionary with langauge plugins,
   * create a new instance of Wrattler and render it in a given HTML document element.
   * 
   * @param elementID HTML document element to be used for rendering the notebook.
   * @param content Initial source code for the notebook in Markdown.
   * @param languagePlugins Language plugins to be used, typically the result of `getDefaultLanguages`
   */
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

export {
  Wrattler,
  LanguagePlugins,
  WrattlerNotebook
}