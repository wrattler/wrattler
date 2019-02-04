import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { Widget } from '@phosphor/widgets';
import '../style/index.css';
////@ts-ignore
// import * as wrattler from '../../client/build/wrattler-app.js'
// import * as wrattler from 'wrattler-app'
// import wrattler = require("../../client/build/wrattler-app");
// import {initializeNotebook}
// var wrattler = require("wrattler-app.js");

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

  constructor() {


    console.log("Constructing RenderedWrattler3")
    super();

    this.id = 'wrattler-jupyterlab';
    this.title.label = 'Wrattler';
    this.title.closable = true;       
    this.addClass('jp-xkcdWidget');
    
    this.wrattlerScript = document.createElement("script");
    this.wrattlerScript.setAttribute("src","https://wrattlerdatastore.blob.core.windows.net/lib/wrattler-app.js");
    this.wrattlerScript.setAttribute("type","text/javascript");
    document.head.appendChild(this.wrattlerScript)

    // let entry = document.createElement("script");
    // entry.setAttribute("src","function go() { initializeNotebook ('main')} ")
    // document.head.appendChild(entry)

    this.wrattlerDiv = document.createElement('div');
    this.wrattlerDiv.setAttribute("id","wrattler");
    this.node.appendChild(this.wrattlerDiv);

    this.wrattlerScript.onload = function() {
      // go();
      // initializeNotebook('main')
      // eval("window.initializeNotebook('wrattler')")
      console.log("Initialised notebook")
    }

    this.img = document.createElement('img');
    this.img.className = 'jp-xkcdCartoon';
    this.node.appendChild(this.img);

    this.img.insertAdjacentHTML('afterend',
      `<div class="jp-xkcdAttribution">
        <a href="https://creativecommons.org/licenses/by-nc/2.5/" class="jp-xkcdAttribution" target="_blank">
          <img src="https://licensebuttons.net/l/by-nc/2.5/80x15.png" />
        </a>
      </div>`
    );
    
    this._mimeType = MIME_TYPE;
  }

  /**
   * The image element associated with the widget.
   */
  readonly img: HTMLImageElement;
  readonly wrattlerDiv: HTMLDivElement;
  readonly wrattlerScript: HTMLScriptElement;
  private _mimeType: string;
  
  /**
   * Dispose of the widget.
   */
  dispose(): void {
    // Dispose of leaflet map
    // this._map.remove();
    // this._map = null;
    super.dispose();
  }

  /**
   * Render Wrattler into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const data = model.data[this._mimeType] as any ;
    const metadata = (model.metadata[this._mimeType] as any) || {};
    console.log("data: "+JSON.stringify(data))
    console.log("metadata: "+JSON.stringify(metadata))
    return new Promise<void> ((resolve)=>{
      fetch('https://egszlpbmle.execute-api.us-east-1.amazonaws.com/prod').then(response => {
        console.log("response:"+JSON.stringify(response))
        return response.json();
      }).then(data => {
        console.log("xkcd: "+JSON.stringify(data.img))
        this.img.src = data.img;
        this.img.alt = data.title;
        this.img.title = data.alt;

        // eval("window.initializeNotebook('wrattler')")
        // this.wrattlerDiv.innerText = "Why doesn't this work";
        console.log("Element: "+JSON.stringify(document.getElementById("wrattler")));
        eval("window.initializeNotebook('wrattler')")
        console.log("Rendering notebook")
        
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
  createRenderer: options => new RenderedWrattler()
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
