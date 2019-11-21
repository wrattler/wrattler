var colors = [ "#8DD3C7", "#BEBADA", "#FDB462", "#B3DE69", "#FB8072" ]

function createGraphVizBody(id) {
  var container = document.getElementById(id);  

  var nodes = []
  var edges = []
  var added = {}

  function walkNode(node, parentId, lvl) {
    if (parentId != null)
      edges.push({"from":parentId, "to":node.hash,
       arrows: { "to": { enabled: true, type: "triangle" } } });

    if (added[node.hash]) return;
    added[node.hash] = true;
    
    let lbl = node.hash;
    if (node.kind) lbl = node.language + " " + node.kind; 
    else if (node.kind == "export") lbl = "export " + node.variableName;
    else if (node.language == "markdown") lbl = "markdown";

    let clr = colors[Object.keys(context.languagePlugins).indexOf(node.language) % 5];

    let gn = {"id":node.hash, "label":lbl, "color":clr, "level":lvl }
    if (node.kind == "code" || node.language == "markdown") { 
      gn.physics = false;
      gn.x = 100;
      gn.y = lvl * 100;
    }
    nodes.push(gn);
    for(var a of node.antecedents) walkNode(a, node.hash, lvl);
  }

  let allNodes = context.cells.map(c => c.exports.concat(c.code))
  for(let i = 0; i < allNodes.length; i++) {
    for(let n of allNodes[i]) walkNode(n, null, i);
  }

  var visNodes = new vis.DataSet(nodes);
  var visEdges = new vis.DataSet(edges);
  var data = { nodes: visNodes, edges: visEdges };
  var options = { physics: {enabled: true, solver: "repulsion" } };
  var network = new vis.Network(container, data, options);
}

function createGraphViz() {
  var found = false;
  var url = "https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis-network.min.js";
  for(let c of document.head.children) if (c.src == url) { found=true; break; }
  if (!found) {
    var scr = document.createElement("script");
    scr.setAttribute("src", url);
    document.head.appendChild(scr);
  }
  makeFullScreen({key:"graphviz", title:"Wrattler dependency graph", height:600}, function(id) {
    function check() { 
      if (typeof(vis) != "undefined") createGraphVizBody(id)
      else window.setTimeout(check, 100);
    }
    window.setTimeout(check, 100);  
  });
};