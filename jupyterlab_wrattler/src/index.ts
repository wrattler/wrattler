import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { Widget } from '@phosphor/widgets';
import '../style/index.css';


/**
 * The CSS class for a Wrattler icon.
 */
const CSS_ICON_CLASS = 'WrattlerIcon';
const CSS_CLASS = 'jp-Wrattler';

/**
 * The MIME type for Wrattler.
 */
export const MIME_TYPE = 'text/plain';
/** @hidden */

export const USE_BINDER= getUseBinder();

function getUseBinder() {
  let baseURL:string = window.location.hostname
  console.log("BaseURL is: ".concat(baseURL))
  if ((baseURL == "127.0.0.1") || (baseURL == "localhost") || (baseURL == "0.0.0.0"))
    return false
  else
    return true
}


class RenderedWrattler extends Widget implements IRenderMime.IRenderer {

  /**
   * Construct a new widget.
   */
  constructor(options: IRenderMime.IRendererOptions) {

    function getRandomInt(max:number) {
      return Math.floor(Math.random() * Math.floor(max));
    }

    let index = getRandomInt(1000)
    let wrattler = new PrivateWrattler(index)
    super({node:wrattler.createNode()});
    this.wrattlerClass = wrattler
    this.id = 'paperparent'.concat(index.toString());
    this.title.label = 'Wrattler';
    this.title.closable = true;
    this.addClass(CSS_CLASS);
    // console.log(this)
    // console.log(this.hasClass(CSS_CLASS))
    this._mimeType = options.mimeType;
    this.firstRender = true;
  }

  /**
   * The image element associated with the widget.
   */
  readonly img: HTMLImageElement;
  private _mimeType: string;
  private wrattlerClass:PrivateWrattler;
  private firstRender:boolean

  /**
   * Dispose of the widget.
   */
  dispose(): void {
    super.dispose();
  }

  /**
   * Render Wrattler into this widget's node.
   */
  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    let content = model.data[this._mimeType] as string

    var i = 0;
    while (!(<any>window).wrattler) {
      console.log("Waiting for wrattler-app.js to be loaded... (" + (i++) + ")")
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    console.log("wrattler-app.js is available. Creating notebook...")

    if (this.firstRender) {
      this.wrattlerClass.initNotebook(content, model)
      this.firstRender = false
    }
    this.update();
  }
}


/**
 * A mime renderer factory for Wrattler data.
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: [MIME_TYPE],
  defaultRank: 75,
  createRenderer: (options: IRenderMime.IRendererOptions) => new RenderedWrattler(options)
};

const extensions: IRenderMime.IExtension | IRenderMime.IExtension[] = [
  {
    id: '@jupyterlab/wrattler-extension:factory',
    rendererFactory,
    rank: 0,
    dataType: 'string',
    fileTypes: [
      {
        name: 'wrattler',
        mimeTypes: [MIME_TYPE],
        extensions: ['.wrattler'],
        iconClass: CSS_ICON_CLASS
      }
    ],
    documentWidgetFactoryOptions: {
      name: 'Wrattler',
      primaryFileType: 'wrattler',
      fileTypes: ['wrattler'],
      defaultFor: ['wrattler']
    }
  }
];

export default extensions;
class PrivateWrattler {

  elementID: string

  constructor(index:number) {
    this.elementID = "paper".concat(index.toString())
    console.log("Use Binder".concat(USE_BINDER.valueOf.toString()))
  }

  getResourceServerURL():string {
      let resourceServerUrl = window.location.protocol+"//"+window.location.hostname
      let clientPort = "8080"
    // THIS IS FOR TESTING BINDER
    if (USE_BINDER){
	resourceServerUrl = window.location.href;
	resourceServerUrl = resourceServerUrl.replace("lab","proxy/");
    }
    else {
      resourceServerUrl = resourceServerUrl.concat(":")
    }
    console.log("Will look for wrattler-app.js here:" +resourceServerUrl.concat(clientPort))
    return resourceServerUrl.concat(clientPort)
  }

  getServiceServerURL() {
    let pythonPort: string = "7101"
    let racketPort: string = "7104"
    let rPort: string = "7103"

    let baseURL:string = window.location.protocol+"//"+window.location.hostname
    console.log("Using Binder flag set to: ".concat(JSON.stringify(USE_BINDER)))
    if (USE_BINDER){
	      baseURL = window.location.href;
	      baseURL = baseURL.replace("lab","proxy/");
    }
    else {
        baseURL = baseURL.concat(":")
    }

    console.log("Will look for r here:" +baseURL.concat(rPort))
    console.log("Will look for python here:" +baseURL.concat(pythonPort))
    console.log("Will look for racket here:" +baseURL.concat(racketPort))

    return {
      "r": baseURL.concat(rPort),
      "python": baseURL.concat(pythonPort),
      "racket": baseURL.concat(racketPort)
    }
  }

    getDataStoreURL() {
    let datastorePort: string = "7102"

    let baseURL:string = window.location.protocol+"//"+window.location.hostname
    if (USE_BINDER){
      baseURL = window.location.href;
      baseURL = baseURL.replace("lab","proxy/");
    }
    else {
      baseURL = baseURL.concat(":")
    }
    console.log("Will look for datastore here:" +baseURL.concat(datastorePort))
    return baseURL.concat(datastorePort)
  }

  createNode(): HTMLElement {
    let wrattlerScript: HTMLScriptElement;
    wrattlerScript = document.createElement("script");
    let resourceServerURL = this.getResourceServerURL()
    wrattlerScript.setAttribute("src",resourceServerURL.concat("/wrattler-app.js"));
    wrattlerScript.setAttribute("type","text/javascript");
    document.head.appendChild(wrattlerScript)
    let wrattlerParentDiv: HTMLDivElement = document.createElement('div');
    let wrattlerDiv: HTMLDivElement = document.createElement('div');
    wrattlerDiv.setAttribute("id",this.elementID);
    wrattlerParentDiv.appendChild(wrattlerDiv)
    return wrattlerParentDiv;
  }

  initNotebook (content:string, model:IRenderMime.IMimeModel) {
    let services = this.getServiceServerURL()
    let storage = this.getDataStoreURL()
    var cfg = (<any>window).wrattler.getDefaultConfig(services, storage);
    cfg.resourceServerUrl = this.getResourceServerURL();

    (<any>window).wrattler.createNotebook(this.elementID, content, cfg).then(function(notebook:any) {
      notebook.addDocumentContentChanged(function (newContent:string) {
        let newOptions: IRenderMime.IMimeModel.ISetDataOptions = {}
        newOptions.data={"text/plain": newContent}
        model.setData(newOptions)
      })
    });
  }
}
