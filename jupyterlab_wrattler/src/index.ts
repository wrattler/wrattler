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


class RenderedWrattler extends Widget implements IRenderMime.IRenderer {

  /**
   * Construct a new xkcd widget.
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
    this.firstRender = true

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
    if (this.firstRender) {
      let content = model.data[this._mimeType] as string ;
      this.wrattlerClass.initNotebook(content, model)
      this.firstRender = false;
    }
    this.update()
  }
  // renderModel(model: IRenderMime.IMimeModel): Promise<void> {
  //   let content = model.data[this._mimeType] as string ;

  //   return new Promise<void> ((resolve)=>
  //   {
  //     setTimeout(()=>{
  //       if (this.firstRender) {
  //         this.wrattlerClass.initNotebook(content, model)
  //         this.firstRender = false
  //       }
  //       this.update();
  //       resolve()
  //     },1*1000)
  //   })
  // }
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

  }

  getResourceServerURL():string {
    // sagemaker: https://nb-wrattler-test-12.notebook.us-east-2.sagemaker.aws/proxy/8080/wrattler-app.js
    let windowUrl:string = window.location.href
    let resourceServerUrl = window.location.protocol+"//"+window.location.hostname

    if (windowUrl.includes('sagemaker.aws')){
      resourceServerUrl = resourceServerUrl.concat("/proxy/8080/")
    }
    else {
      // THIS IS FOR TESTING BINDER
      resourceServerUrl = resourceServerUrl.concat(":"+location.port).concat("/proxy/8080/")
      console.log("Will look for wrattler-app.js here:" +resourceServerUrl)
      // resourceServerUrl = resourceServerUrl.concat(":8080/")

    }
    return resourceServerUrl
  }

  getServiceServerURL() {
    /*
    - CLIENT_URI=http://localhost:8080
     - RACKETSERVICE_URI=http://localhost:7104
     - PYTHONSERVICE_URI=http://localhost:7101
     - RSERVICE_URI=http://localhost:7103
     - DATASTORE_URI=http://localhost:7102
    */
   //https://nb-wrattler-test-12.notebook.us-east-2.sagemaker.aws/proxy/7101/test
    let windowUrl:string = window.location.href
    let pythonPort: string = "7101"
    let racketPort: string = "7104"
    let rPort: string = "7103"
    let baseURL:string = window.location.protocol+"//"+window.location.hostname
    if (windowUrl.includes('sagemaker.aws')){
      baseURL = baseURL.concat("/proxy/")
    }
    else {
      baseURL = baseURL.concat(":"+location.port).concat("/proxy/")
      // baseURL = baseURL.concat(":")
    }
    return {
      "r": baseURL.concat(rPort),
      "python": baseURL.concat(pythonPort),
      "racket": baseURL.concat(racketPort)}
  }

  createNode(): HTMLElement {
    let wrattlerScript: HTMLScriptElement;
    wrattlerScript = document.createElement("script");
    let resourceServerURL = this.getResourceServerURL()
    console.log("This is for binder: ".concat(resourceServerURL.concat("wrattler-app.js")))
    wrattlerScript.setAttribute("src",resourceServerURL.concat("wrattler-app.js"));
    wrattlerScript.setAttribute("type","text/javascript");
    document.head.appendChild(wrattlerScript)
    let wrattlerParentDiv: HTMLDivElement = document.createElement('div');
    let wrattlerDiv: HTMLDivElement = document.createElement('div');
    wrattlerDiv.setAttribute("id",this.elementID);
    wrattlerParentDiv.appendChild(wrattlerDiv)
    return wrattlerParentDiv;
  }

  initNotebook (content:string, model:IRenderMime.IMimeModel) {
    var services = this.getServiceServerURL()
    var cfg = (<any>window).wrattler.getDefaultConfig(services);
    cfg.resourceServerUrl = this.getResourceServerURL();

    (<any>window).wrattler.createNotebook(this.elementID, content, cfg).then(function(notebook:any) {
      console.log("Wrattler created: "+JSON.stringify((<any>window).wrattler))
      notebook.addDocumentContentChanged(function (newContent:string) {
        let newOptions: IRenderMime.IMimeModel.ISetDataOptions = {}
        newOptions.data={"text/plain": newContent}
        console.log("setting data")
        model.setData(newOptions)
        console.log("data set")
      })

    });
  }
}
