var loaded = [];

function loadScript(url) { 
  if (!loaded.includes(url))
  {
    var scr = document.createElement("script");
    scr.setAttribute("src", url);
    document.head.appendChild(scr);
    loaded.push(url)
    console.log("Scripts loaded: "+JSON.stringify(loaded))
  }
}