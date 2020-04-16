var loaded = [];

function loadScript(url) { 
  if (!loaded.includes(url))
  {
    var scr = document.createElement("script");
    scr.setAttribute("src", url);
    document.head.appendChild(scr);
    loaded.push(url)
    console.log("Styles and scripts loaded: "+JSON.stringify(loaded))
  }
}

function loadStyle(url) { 
  if (!loaded.includes(url))
  {
    var scr = document.createElement("link");
    scr.setAttribute("href", url);
    scr.setAttribute("rel", "stylesheet");
    document.head.appendChild(scr);
    loaded.push(url)
    console.log("Styles and scripts loaded: "+JSON.stringify(loaded))
  }
}

var inline = [];

function loadInlineStyle(style) { 
  if (!inline.includes(style))
  {
    var scr = document.createElement("style");
    scr.setAttribute("type", "text/css");
    scr.innerHTML = style;
    document.head.appendChild(scr);
    inline.push(style)
  }
}