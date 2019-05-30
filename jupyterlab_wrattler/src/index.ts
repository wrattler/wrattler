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
  }

  /**
   * The image element associated with the widget.
   */
  readonly img: HTMLImageElement;
  private _mimeType: string;
  private wrattlerClass:PrivateWrattler;
  
  /**
   * Dispose of the widget.
   */
  dispose(): void {
    super.dispose();
  }

  /**
   * Render Wrattler into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    let content = model.data[this._mimeType] as string ; 
    
    return new Promise<void> ((resolve)=>
    {
      setTimeout(()=>{
        this.wrattlerClass.initNotebook(content, model)
        this.update();
        resolve()
      },1*1000)
    })
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
  }

  createNode(): HTMLElement { 
    let wrattlerScript: HTMLScriptElement;
    wrattlerScript = document.createElement("script");
    wrattlerScript.setAttribute("src","http://localhost:8080/wrattler-app.js");
    wrattlerScript.setAttribute("type","text/javascript");
    document.head.appendChild(wrattlerScript)
    let wrattlerParentDiv: HTMLDivElement = document.createElement('div');
    let wrattlerDiv: HTMLDivElement = document.createElement('div');
    wrattlerDiv.setAttribute("id",this.elementID);
    wrattlerParentDiv.appendChild(wrattlerDiv)
    return wrattlerParentDiv;
  }

  initNotebook (content:string, model:IRenderMime.IMimeModel) {
    var langs = (<any>window).wrattler.getDefaultLanguages();
    (<any>window).wrattler.createNotebook(this.elementID, content, langs).then(function(notebook:any) {
      console.log("Wrattler created: "+JSON.stringify((<any>window).wrattler))
      notebook.addDocumentContentChanged(function (newContent:string) {
        let newOptions: IRenderMime.IMimeModel.ISetDataOptions = {}
        newOptions.data={"text/plain": newContent}
        model.setData(newOptions)
      })
    });
  }
}
