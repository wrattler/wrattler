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
import { JavascriptLanguagePlugin } from './languages/javascript'
import { ExternalLanguagePlugin } from './languages/external'
import { mergerLanguagePlugin } from './demo/merger'

/** @hidden */
declare var PYTHONSERVICE_URI: string;
/** @hidden */
declare var RSERVICE_URI: string;
/** @hidden */
declare var RACKETSERVICE_URI: string;
/** @hidden */
declare var CLIENT_URI: string;
/** @hidden */
declare var DATASTORE_URI: string;

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
 * Wrattler notebook configuration. This currently specifies the language plugins
 * to be used and URLs for services used by Wrattler such as the resource service and data store. 
 */
interface WrattlerConfig {
  /** URL for a service that can be used for loading resources using `%global` or `%local`. If you 
   * say `%global test.py`, Wrattler will fetch the file from `<resourceServerUrl>/resources/test.py`. */
  resourceServerUrl : string
  /** A dictionary with language names as keys that specifies language plugins to be used. */
  languagePlugins : LanguagePlugins
  datastoreURL: string
}

/**
 * Main entry point that can be used for creating new Wrattler notebook instances.
 * You can use `getDefaultLanguages` to get default language plugins implemented 
 * in core Wrattler and `createNotebook` to create a new notebook instance.
 */
class Wrattler {
  /** Creates a new `LanguagePlugin` instance which delegates binding and evaluation
   * to a specified langauge service. You can pass the returned `LanguagePlugin` to
   * the `createNotebook` function to get a notebook supporting this langauge.  */
  // createExternalLanguagePlugin(language, serviceUrl:string, faClass?:string, defaultCode?:string) {
  //   return new ExternalLanguagePlugin(language, faClass?faClass:"fa fa-question-circle", serviceUrl, defaultCode?defaultCode:"");
  // }

  /**
   * Returns default language plugins for Markdown, JavaScript, R, Python and Racket.
   * The `serviceUrls` argument specifies a dictionary with URLs for the services. You can
   * use this to override the default URLs specified by Docker config (use `python`, `r` and `racket` 
   * as the keys in the dictionary).
   */
  getDefaultConfig(serviceUrls? : { [language:string] : string }, datastoreUrl?: string ) : WrattlerConfig {
    var languagePlugins : LanguagePlugins = { };
    
    function getServiceUrl(language:string, def:string) {
      if (serviceUrls && serviceUrls[language]) return serviceUrls[language];
      else return def;
    }    

    let pyCode =  "# This is a python cell \n# py[ID] = pd.DataFrame({\"id\":[\"[ID]\"], \"language\":[\"python\"]})";
    let rCode = "# This is an R cell \n r[ID] <- data.frame(id = [ID], language =\"r\")";
    let rcCode = ";; This is a Racket cell [ID]\n";

    languagePlugins["markdown"] = markdownLanguagePlugin;
    languagePlugins["javascript"] = new JavascriptLanguagePlugin(datastoreUrl ? datastoreUrl : DATASTORE_URI);
    languagePlugins["python"] = new ExternalLanguagePlugin("python", "fab fa-python", getServiceUrl("python", PYTHONSERVICE_URI), pyCode, (datastoreUrl ? datastoreUrl : DATASTORE_URI));
    languagePlugins["r"] = new ExternalLanguagePlugin("r", "fab fa-r-project", getServiceUrl("r", RSERVICE_URI), rCode, (datastoreUrl ? datastoreUrl : DATASTORE_URI));
    languagePlugins["racket"] = new ExternalLanguagePlugin("racket", "fa fa-question-circle", getServiceUrl("racket", RACKETSERVICE_URI), rcCode, (datastoreUrl ? datastoreUrl : DATASTORE_URI));
    // languagePlugins["merger"] = mergerLanguagePlugin;
    let newConfig:WrattlerConfig = { languagePlugins:languagePlugins, resourceServerUrl:CLIENT_URI, datastoreURL: (datastoreUrl ? datastoreUrl : DATASTORE_URI) };
    console.log("Wrattler configured as: "+JSON.stringify(languagePlugins["python"]))
    return newConfig
  }

  /**
   * Creates a Wrattler notebook that loads notebooks automatically by requesting the `index.md` 
   * URL from the domain where it is hosted (or `another.md` when the current URl contains `?another` in the query string).
   */
  async createNamedNotebook(elementID:string, config:WrattlerConfig) : Promise<WrattlerNotebook> {
    return this.createNotebook(elementID, await Docs.getNamedDocumentContent(), config);
  }

  /**
   * Given initial Markdown source code and a dictionary with langauge plugins,
   * create a new instance of Wrattler and render it in a given HTML document element.
   * 
   * @param elementID HTML document element to be used for rendering the notebook.
   * @param content Initial source code for the notebook in Markdown.
   * @param languagePlugins Language plugins to be used, typically the result of `getDefaultLanguages`
   */
  async createNotebook(elementID:string, content:string, config:WrattlerConfig) : Promise<WrattlerNotebook> {
    Log.trace("main", "Creating notebook for id '%s'", elementID)
    let documents = await Docs.getDocument(content);
    var {counter, editors} = loadNotebook(documents, config.languagePlugins);

    var currentContent = content;
    var handlers : ((newContent:string) => void)[] = [];
    function contentChanged(newContent:string) {
      currentContent = newContent;
      for(var h of handlers) h(currentContent);
    }

    initializeCells(elementID, counter, editors, config.languagePlugins, config.resourceServerUrl, contentChanged);
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
  WrattlerNotebook,
  WrattlerConfig
}