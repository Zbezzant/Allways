/**
  @author David Piegza

  Implements a simple graph drawing with force-directed placement in 2D and 3D.

  It uses the force-directed-layout implemented in:
  https://github.com/davidpiegza/Graph-Visualization/blob/master/layouts/force-directed-layout.js

  Drawing is done with Three.js: http://github.com/mrdoob/three.js

  To use this drawing, include the graph-min.js file and create a SimpleGraph object:

  <!DOCTYPE html>
  <html>
    <head>
      <title>Graph Visualization</title>
      <script type="text/javascript" src="path/to/graph-min.js"></script>
    </head>
    <body onload="new Drawing.SimpleGraph({layout: '3d', showStats: true, showInfo: true})">
    </bod>
  </html>

  Parameters:
  options = {
    layout: "2d" or "3d"

    showStats: <bool>, displays FPS box
    showInfo: <bool>, displays some info on the graph and layout
              The info box is created as <div id="graph-info">, it must be
              styled and positioned with CSS.


    selection: <bool>, enables selection of nodes on mouse over (it displays some info
               when the showInfo flag is set)


    limit: <int>, maximum number of nodes

  }


  Feel free to contribute a new drawing!

 */

var Drawing = Drawing || {};


Drawing.SimpleGraph = function(options) {
  options = options || {};

  this.layout = options.layout || "2d";
  this.layout_options = options.graphLayout || {};
  this.show_stats = options.showStats || false;
  this.show_info = options.showInfo || false;
  this.show_labels = options.showLabels || true;
  this.selection = options.selection || false;
  this.limit = options.limit || 10;
  this.label_font_family = options.labelFontFamily || "'OpenDyslexic', 'OpenDyslexic-Regular', 'OpenDyslexicAlta', Arial, sans-serif";
  this.label_font_size = options.labelFontSize || "40pt";

  var camera, controls, scene, renderer, interaction, geometry, object_selection;
  var stats;
  var info_text = {};
  var graph = new GRAPHVIS.Graph({limit: options.limit});
  var nextNodeId = 9999; // start high to avoid collisions with createGraph()
  var editingNode = null;

  var geometries = [];

  var that=this;

  init();
  createGraph();
  animate();

  function init() {
    // Three.js initialization
    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);


    camera = new THREE.PerspectiveCamera(40, window.innerWidth/window.innerHeight, 1, 1000000);
    camera.position.z = 10000;

    controls = new THREE.TrackballControls(camera);

    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.3;

    controls.noZoom = false;
    controls.noPan = false;

    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.3;

    controls.keys = [ 65, 83, 68 ];

    controls.addEventListener('change', render);

    scene = new THREE.Scene();

    // Node geometry
    if(that.layout === "3d") {
      geometry = new THREE.SphereGeometry(30);
    } else {
      geometry = new THREE.BoxGeometry( 50, 50, 0 );
    }

    // Create node selection, if set
      object_selection = new THREE.ObjectSelection({
          domElement: renderer.domElement,
          selected: function(obj) {
              if(obj !== null) {
                  info_text.select = "Object " + obj.id;
              } else {
                  delete info_text.select;
              }
          },
          clicked: function(obj) {
              var sourceNode = obj._graphNode;
              if(sourceNode) {          // ignore clicks on labels/edges
                  addNodeToGraph(sourceNode);
              }
          },
          rightClicked: function(obj) {
              var node = obj._graphNode;
              if(node) showEditPopup(node);
          }
      });

      var _mouseDownX = 0, _mouseDownY = 0, _wasDragged = false;
      var DRAG_THRESHOLD = 5;

      renderer.domElement.addEventListener('mousedown', function(e) {
          _mouseDownX = e.clientX;
          _mouseDownY = e.clientY;
          _wasDragged = false;
      }, true);

      renderer.domElement.addEventListener('mousemove', function(e) {
          var dx = e.clientX - _mouseDownX;
          var dy = e.clientY - _mouseDownY;
          if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) {
              _wasDragged = true;
          }
      }, true);

      renderer.domElement.addEventListener('click', function(e) {
          if (_wasDragged) e.stopImmediatePropagation();
      }, true);

      renderer.domElement.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          if (_wasDragged) e.stopImmediatePropagation();
      }, true);



    document.body.appendChild( renderer.domElement );

    // Stats.js
    if(that.show_stats) {
      stats = new Stats();
      stats.domElement.style.position = 'absolute';
      stats.domElement.style.top = '0px';
      document.body.appendChild( stats.domElement );
    }

    // Create info box
    if(that.show_info) {
      var info = document.createElement("div");
      var id_attr = document.createAttribute("id");
      id_attr.nodeValue = "graph-info";
      info.setAttributeNode(id_attr);
      document.body.appendChild( info );
    }

      createEditPopup();
  }


  /**
   *  Creates a graph with random nodes and edges.
   *  Number of nodes and edges can be set with
   *  numNodes and numEdges.
   */
  function createGraph() {
      var node = new GRAPHVIS.Node(0);
      node.data.title = "Start";
      graph.addNode(node);
      drawNode(node);

      // Pin it to world center
      node.position.x = 0;
      node.position.y = 0;
      node.position.z = 0;
      node.data.draw_object.position.set(0, 0, 0);

      that.layout_options.width = that.layout_options.width || 2000;
      that.layout_options.height = that.layout_options.height || 2000;
      that.layout_options.iterations = that.layout_options.iterations || 100000;
      that.layout_options.layout = that.layout_options.layout || that.layout;
      graph.layout = new Layout.ForceDirected(graph, that.layout_options);
      graph.layout.init();
      info_text.nodes = "Nodes " + graph.nodes.length;
      info_text.edges = "Edges " + graph.edges.length;
  }

  /**
  *  Create a node object and add it to the scene by clicking a currently existing node.
  */
  function addNodeToGraph(sourceNode) {
      var newNode = new GRAPHVIS.Node(nextNodeId++);
      newNode.data.title = "Node " + newNode.id;

      if(!graph.addNode(newNode)) return; // duplicate ID guard

      drawNode(newNode);
      // Spawn it near the parent so the layout has a sensible starting point
      var jitter = 500;
      newNode.position.x = sourceNode.position.x + (Math.random() - 0.5) * jitter;
      newNode.position.y = sourceNode.position.y + (Math.random() - 0.5) * jitter;
      if(that.layout === "3d") {
          newNode.position.z = sourceNode.position.z + (Math.random() - 0.5) * jitter;
      }


      if(graph.addEdge(sourceNode, newNode)) {
          drawEdge(sourceNode, newNode);
      }

      // Wake the layout back up so it repositions everyone
      graph.layout = new Layout.ForceDirected(graph, that.layout_options);
      graph.layout.init();

      info_text.nodes = "Nodes " + graph.nodes.length;
      info_text.edges  = "Edges " + graph.edges.length;
  }

  /**
   *  Create a node object and add it to the scene.
   */
  function drawNode(node) {
    var draw_object = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {  color: Math.random() * 0xe0e0e0, opacity: 0.8 } ) );
    var label_object;

    if(that.show_labels) {
      if(node.data.title !== undefined) {
        label_object = new THREE.Label(node.data.title, {fontFamily: that.label_font_family, fontSize: that.label_font_size});
      } else {
        label_object = new THREE.Label(node.id, {fontFamily: that.label_font_family, fontSize: that.label_font_size});
      }
      node.data.label_object = label_object;
      label_object._graphNode = node;
      scene.add( node.data.label_object );
    }

    var area = 5000;
    draw_object.position.x = Math.floor(Math.random() * (area + area + 1) - area);
    draw_object.position.y = Math.floor(Math.random() * (area + area + 1) - area);

    if(that.layout === "3d") {
      draw_object.position.z = Math.floor(Math.random() * (area + area + 1) - area);
    }

    node.data.draw_object = draw_object;
    draw_object._graphNode = node;
    node.position = draw_object.position;
    scene.add( node.data.draw_object );
  }


  /**
   *  Create an edge object (line) and add it to the scene.
   */
  function drawEdge(source, target) {
      material = new THREE.LineBasicMaterial({ color: 0x606060 });

      var tmp_geo = new THREE.Geometry();
      tmp_geo.vertices.push(source.data.draw_object.position);
      tmp_geo.vertices.push(target.data.draw_object.position);

      line = new THREE.LineSegments( tmp_geo, material );
      line.scale.x = line.scale.y = line.scale.z = 1;
      line.originalScale = 1;

      // NOTE: Deactivated frustumCulled, otherwise it will not draw all lines (even though
      // it looks like the lines are in the view frustum).
      line.frustumCulled = false;

      geometries.push(tmp_geo);

      scene.add( line );
  }


  function animate() {
    requestAnimationFrame( animate );
    controls.update();
    render();
    if(that.show_info) {
      printInfo();
    }
  }


  function render() {
    var i, length, node;

    // Generate layout if not finished
    if(!graph.layout.finished) {
      info_text.calc = "<span style='color: red'>Calculating layout...</span>";
      graph.layout.generate();
    } else {
      info_text.calc = "";
    }

    // Update position of lines (edges)
    for(i=0; i<geometries.length; i++) {
      geometries[i].verticesNeedUpdate = true;
    }



    // Show labels if set
    // It creates the labels when this options is set during visualization
    if(that.show_labels) {
        // Pass 1: min/max
        var minDist = Infinity, maxDist = -Infinity;
        for(i = 0; i < graph.nodes.length; i++) {
            node = graph.nodes[i];
            if(node.data.label_object && node.data.draw_object) {
                var d = camera.position.distanceTo(node.data.draw_object.position);
                if(d < minDist) minDist = d;
                if(d > maxDist) maxDist = d;
            }
        }
        var range = maxDist - minDist || 1;

        // Pass 2: position + billboard + color all in one
        length = graph.nodes.length;
        for(i = 0; i < length; i++) {
            node = graph.nodes[i];
            if(node.data.label_object !== undefined) {
                node.data.label_object.position.x = node.data.draw_object.position.x;
                node.data.label_object.position.y = node.data.draw_object.position.y - 100;
                node.data.label_object.position.z = node.data.draw_object.position.z;
                node.data.label_object.quaternion.copy(camera.quaternion);

                var dist = camera.position.distanceTo(node.data.draw_object.position);
                var t = (dist - minDist) / range;
                node.data.label_object.material.opacity = 1.0 - (t * 0.7);
            } else {
                var label_object;
                if (node.data.title !== undefined) {
                    label_object = new THREE.Label(node.data.title, {fontFamily: that.label_font_family, fontSize: that.label_font_size});
                } else {
                    label_object = new THREE.Label(node.id, {fontFamily: that.label_font_family, fontSize: that.label_font_size});
                }
                node.data.label_object = label_object;
                scene.add(node.data.label_object);
                label_object._graphNode = node;
            }
        }
    } else {
      length = graph.nodes.length;
      for(i=0; i<length; i++) {
        node = graph.nodes[i];
        if(node.data.label_object !== undefined) {
          scene.remove( node.data.label_object );
          node.data.label_object = undefined;
        }
      }
    }


    // render selection
    object_selection.render(scene, camera);

    // update stats
    if(that.show_stats) {
      stats.update();
    }

    // render scene
    renderer.render( scene, camera );
  }

    function createEditPopup() {
        document.getElementById('edit-overlay').addEventListener('click', function(e) {
            if(e.target === this) closeEditPopup();
        });
        document.getElementById('edit-cancel').addEventListener('click', closeEditPopup);
        document.getElementById('edit-save').addEventListener('click', saveEditPopup);
        document.getElementById('edit-label').addEventListener('keydown', function(e) {
            if(e.key === 'Enter') saveEditPopup();
            if(e.key === 'Escape') closeEditPopup();
        });
        document.getElementById('edit-description').addEventListener('keydown', function(e) {
            if(e.key === 'Escape') closeEditPopup();
        });
    }


    function showEditPopup(node) {
        editingNode = node;
        document.getElementById('edit-label').value = node.data.title || node.id;
        document.getElementById('edit-description').value = node.data.description || '';
        document.getElementById('edit-overlay').style.display = 'flex';
        document.getElementById('edit-label').focus();
        document.getElementById('edit-label').select();
    }

    function closeEditPopup() {
        editingNode = null;
        document.getElementById('edit-overlay').style.display = 'none';
    }

    function saveEditPopup() {
        if(!editingNode) return;
        var newLabel = document.getElementById('edit-label').value.trim() || String(editingNode.id);
        editingNode.data.description = document.getElementById('edit-description').value;
        updateNodeLabel(editingNode, newLabel);
        closeEditPopup();
    }

    function updateNodeLabel(node, newTitle) {
        if(node.data.label_object) {
            scene.remove(node.data.label_object);
            node.data.label_object = null;
        }

        node.data.title = newTitle;

        if(that.show_labels) {
            var label_object = new THREE.Label(newTitle, {fontFamily: that.label_font_family, fontSize: that.label_font_size});
            label_object._graphNode = node;
            node.data.label_object = label_object;
            scene.add(label_object);
        }
    }

  /**
   *  Prints info from the attribute info_text.
   */
  function printInfo(text) {
    var str = '';
    for(var index in info_text) {
      if(str !== '' && info_text[index] !== '') {
        str += " - ";
      }
      str += info_text[index];
    }
    document.getElementById("graph-info").innerHTML = str;
  }

  // Generate random number
  function randomFromTo(from, to) {
    return Math.floor(Math.random() * (to - from + 1) + from);
  }

  // Stop layout calculation
  this.stop_calculating = function() {
    graph.layout.stop_calculating();
  };
};
