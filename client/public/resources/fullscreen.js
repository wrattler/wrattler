function createDialog(id, title, f) {
  if (!document.getElementById(id)) {
    var dialog = document.createElement("div");
    dialog.id = id;
    dialog.innerHTML = 
      `<div style="background:white;border:solid 5px #d0d0d0;
          position:fixed;width:80vw;height:90vh;left:10vw;top:5vh">
        <div style="color:#c0c0c0;padding:0px 10px 0px 10px">
          <a href="javascript:;" style="color:#c0c0c0; text-decoration:none; font-weight:bold; float:right" id="${ id }-close">x</a>
          <strong>${ title }</strong></div>
        <div id="${ id }-body" style="height:calc(90vh - 35px)"></div>
       </div>`;
    document.body.appendChild(dialog);
    document.getElementById(id + "-close").onclick = function() {
      document.body.removeChild(document.getElementById(id));
    }
    f(id + "-body");
  }
}

function makeFullScreen(options, f) {
  let key = options.key ? options.key : "dialog"
  let title = options.title ? options.title : "Full screen view"
  let style = options.height ? "height:" + options.height + "px" : ""
  addOutput(function (id) {
    document.getElementById(id).innerHTML = 
      `<a id='${ id }-link' href='javascript:;' style='color:#c0c0c0; 
        text-decoration:none; font:bold 10pt Roboto; float:right'>full screen</a>
        <div id='${ id }-small' style='${ style }'></div>`
    document.getElementById(id + "-link").onclick = function () {
      createDialog(key, title, f);
    }
    f(id + "-small")
  });
}