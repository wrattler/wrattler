import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { Widget } from '@phosphor/widgets';
import '../style/index.css';


/**
 * The CSS class for a Wrattler icon.
 */
const CSS_ICON_CLASS = 'WrattlerIcon';

/**
 * The MIME type for Wrattler.
 */
export const MIME_TYPE = 'text/plain';


class RenderedWrattler extends Widget implements IRenderMime.IRenderer {
  /**
   * Construct a new xkcd widget.
   */

  constructor(options: IRenderMime.IRendererOptions) {
    super({node:Private.createNode()});

    this.id = 'wrattler-jupyterlab';
    this.title.label = 'Wrattler';
    this.title.closable = true;       
    this.addClass('jp-xkcdWidget');
    
    // Private.createNode()
    
    this.img = document.createElement('img');
    this.img.className = 'jp-xkcdCartoon';
    this.node.appendChild(this.img);

    let saveButton = document.createElement('button')
    saveButton.innerHTML = "Save me"
    saveButton.addEventListener ("click", () => {
      let documentContent:string = Private.wrattlerToMd();
      let newOptions: IRenderMime.IMimeModel.ISetDataOptions = {}
      newOptions.data={"text/plain": documentContent}
      this.wrattlerDocumentModel.setData(newOptions)
    });
    this.node.appendChild(saveButton);
    

    this.img.insertAdjacentHTML('afterend',
      `<div class="jp-xkcdAttribution">
        <a href="https://creativecommons.org/licenses/by-nc/2.5/" class="jp-xkcdAttribution" target="_blank">
          <img src="https://licensebuttons.net/l/by-nc/2.5/80x15.png" />
        </a>
      </div>`
    );
    
    this._mimeType = options.mimeType;
  }

  /**
   * The image element associated with the widget.
   */
  readonly img: HTMLImageElement;
  // readonly wrattlerDiv: HTMLDivElement;
  // readony wrattlerScript: HTMLScriptElement;
  private _mimeType: string;
  private wrattlerDocumentModel: IRenderMime.IMimeModel
  
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
    console.log("Rendering notebook")
    this.wrattlerDocumentModel = model
    const content = model.data[this._mimeType] as string ; 
    // console.log(model.data)
    
    // let newOptions: IRenderMime.IMimeModel.ISetDataOptions = {}
    // newOptions.data={"text/plain": "Why doesn't this work still?"}
    // model.setData(newOptions)
    return new Promise<void> ((resolve)=>{
      fetch('https://egszlpbmle.execute-api.us-east-1.amazonaws.com/prod').then(response => {
        return response.json();
      }).then(data => {
        this.img.src = data.img;
        this.img.alt = data.title;
        this.img.title = data.alt;

        Private.mdToWrattler(content);
        this.update();
        resolve()
      });
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
  createRenderer: options => new RenderedWrattler(options)
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

namespace Private {
  export function createNode(): HTMLElement {
    let wrattlerDiv: HTMLDivElement;
    let wrattlerScript: HTMLScriptElement;
    wrattlerScript = document.createElement("script");
    // this.wrattlerScript.setAttribute("src","https://wrattlerdatastore.blob.core.windows.net/lib/wrattler-app.js");
    wrattlerScript.setAttribute("src","http://localhost:8080/wrattler-app.js");
    wrattlerScript.setAttribute("type","text/javascript");
    document.head.appendChild(wrattlerScript)

    wrattlerDiv = document.createElement('div');
    wrattlerDiv.setAttribute("id","paper");
    

    let node = document.createElement('div');
    node.appendChild(wrattlerDiv);
    return node;
  }

  export function mdToWrattler(content:string) {
    (<any>window).initializeNotebookJupyterLab('paper', content)
    console.log("Init Notebook")
  }

  export function wrattlerToMd():string {
    let content = (<any>window).exportDocumentContent()
    // console.log("Exported content: "+content)
    return content
  }
}
