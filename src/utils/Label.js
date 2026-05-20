THREE.Label = function(text, parameters) {
    parameters = parameters || {};
    var labelCanvas = document.createElement("canvas");

    function create() {
        var xc = labelCanvas.getContext("2d");
        var fontsize = parameters.fontSize || "40pt";
        var fontFamily = parameters.fontFamily || "'OpenDyslexic', 'OpenDyslexic-Regular', 'OpenDyslexicAlta', Arial, sans-serif";
        var padding = 2;

        xc.font = fontsize + " " + fontFamily;
        var textWidth = xc.measureText(text).width;

        var cw = Math.ceil(textWidth) + padding * 2;
        var ch = 60;

        labelCanvas.setAttribute('width', cw);
        labelCanvas.setAttribute('height', ch);

        xc.font = fontsize + " " + fontFamily;
        xc.textBaseline = 'middle';

        var r = 20;
        xc.fillStyle = 'white';
        xc.beginPath();
        xc.moveTo(r, 0);
        xc.lineTo(cw - r, 0);
        xc.quadraticCurveTo(cw, 0, cw, r);
        xc.lineTo(cw, ch - r);
        xc.quadraticCurveTo(cw, ch, cw - r, ch);
        xc.lineTo(r, ch);
        xc.quadraticCurveTo(0, ch, 0, ch - r);
        xc.lineTo(0, r);
        xc.quadraticCurveTo(0, 0, r, 0);
        xc.closePath();
        xc.fill();

        xc.fillStyle = 'black';
        xc.fillText(text, padding, ch / 2);

        var geometry = new THREE.BoxGeometry(cw, ch, 0);
        var xm = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(
                labelCanvas,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter
            ),
            transparent: true
        });
        xm.map.needsUpdate = true;

        return new THREE.Mesh(geometry, xm);
    }

    return create();
};