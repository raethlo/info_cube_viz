

InfoCube = function(data, domElement, maxChildrenPerBox, depthLimit){

    var container = domElement,
        data = data,
        scene, pickingScene,
        camera,
        renderer,
        controls,
        light,
        root,
        info,
        selected,
        unselectColor,
        cubesToIntersect = [],
        maxChildrenPerBox = maxChildrenPerBox || 30,
        depthLimit = depthLimit || 3;

    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector3();

    var keyboard = new THREEx.KeyboardState();

    function init() {

        camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
        camera.position.z = 500;
        camera.position.x = 600;
        camera.position.y = 800;

        unselectColor = new THREE.Color();

        scene = new THREE.Scene();

        pickingScene = new THREE.Scene();

        renderer = new THREE.WebGLRenderer({antialias:true});
        renderer.setSize( window.innerWidth, window.innerHeight);
        renderer.setClearColor(0xcccccc);

        controls = new THREE.OrbitControls( camera, renderer.domElement );

        THREEx.WindowResize(renderer, camera);
        THREEx.FullScreen.bindKey({ charCode : 'f'.charCodeAt(0) });

        root = createStructure(data, scene, depthLimit, maxChildrenPerBox);

        info = document.createElement( 'div' );

        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.width = '100%';
        info.style.textAlign = 'center';
        info.innerHTML = '<h1>' + root.name + '</h1>';

        console.log(container);

        container.appendChild( info );

        if(root.children) {
            root.children.forEach(function (node) {
                var size = node.geometry.boundingBox.size().x;
                var geom = new THREE.BoxGeometry(size,size,size);
                var mesh = new THREE.Mesh(geom);

                mesh.position.copy(node.position);
                mesh.rotation.copy(node.rotation);

                mesh.userData = node;

                pickingScene.add(mesh);
            });
        }

        var ambientLight = new THREE.AmbientLight(0x101010, 5.0);

        scene.add(ambientLight);

        light = new THREE.PointLight(0xffffff);

        light.position = camera.position;
        scene.add(light);
        container.appendChild( renderer.domElement );

        // when the mouse moves, call the given function
        document.addEventListener( 'click', onDocumentMouseClick, false );
    }

    function Box(options){
        var options = options || {};

        var color = options.color || getRandomColor();
        var opacity = options.opacity || 0.7;
        var size = options.size || 10;
        var name = options.name || "none";
        var order = options.order || 0;

        var geo = new THREE.BoxGeometry(size,size,size);

        var material = new THREE.MeshLambertMaterial({
            transparent: true,
            color: color,
            opacity: opacity,
            side: THREE.BackSide,
            combine: THREE.AdditiveBlending
        });

        m = new THREE.Mesh(geo, material );
        m.name = name;
        m.renderOrder = order;

        return m;
    }

    function Floor(){
        var floorMaterial = new THREE.MeshBasicMaterial( { color: 0xf4a460, side: THREE.DoubleSide } );
        var floorGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
        var floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.y = -100;
        floor.rotation.x = Math.PI / 2;
        return floor;
    }

    function SkyBox(){
        var skyBoxGeometry = new THREE.BoxGeometry( 10000, 10000, 10000 );
        var skyBoxMaterial = new THREE.MeshBasicMaterial( { color: 0x9999ff, side: THREE.BackSide } );
        var skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );
        return skyBox;
    }

    function updateBoundingBox(box){
        if(box.geometry.boundingBox === null){
            box.geometry.computeBoundingBox();
        } else {
            box.geometry.boundingBox.setFromObject(box);
        }
    }

    var arrangeChildren = function(cube){
        if(cube.children.length === 0)
            return;

        var passes = 150;

        updateBoundingBox(cube);
        var children = cube.children;

        for(var i = 0; i < children.length; i++){
            updateBoundingBox(children[i]);
        }

        for(var i = 0; i < passes; i++ ){
            for(var j = 0; j < children.length; j++){
                var currentChild = children[j];

                for( var k = 1; k < children.length; k++){
                    //computes position of child which is to move
                    childToMoveIndex = (j + k + children.length) % children.length;
                    childToMove = children[childToMoveIndex];

                    //creates a normalized vector currentChild -> childToMove
                    vector = childToMove.position.clone().sub(currentChild.position).normalize();

                    //creates a decoiy box and tests if it is still in the parent mesh
                    decoy = new THREE.Box3().setFromObject( childToMove );
                    decoy.position = childToMove.position.clone().add(vector);

                    //if it is in the parent mesh we should update the child's
                    // position and its bounding box
                    if(cube.geometry.boundingBox.containsBox(decoy)){
                        childToMove.position.copy(decoy.position);
                        childToMove.updateMatrix();
                        updateBoundingBox(childToMove);
                    }

                }
            }
        }

        if(children.length < 50)
            children.forEach(arrangeChildren);
    };

    function createChild(parent,options){
        child = new Box(options);

        parent.geometry.computeBoundingBox();

        child.geometry.computeBoundingBox();

        //randomly alter the childs location from (0,0,0)
        child.position.set(
            Math.random() * 2 -1,
            Math.random() * 2 -1,
            Math.random() * 2 -1
        );

        //        scene.add(child);
        parent.add(child);

        return child;
    }

    function updatePickingScene(root,pickingScene){
        while(pickingScene.children && pickingScene.children.length > 0) { pickingScene.children.pop() }

        if(root.children) {
            root.children.forEach(function (node) {
                var size = node.geometry.boundingBox.size().x;
                var geom = new THREE.BoxGeometry(size,size,size);
                var mesh = new THREE.Mesh(geom);

                mesh.position.copy(node.position);
                mesh.rotation.copy(node.rotation);

                mesh.userData = node;

                pickingScene.add(mesh);
            });
        }
    }

    function animate() {
        requestAnimationFrame( animate );

        light.position.set(camera.position.x,camera.position.y,camera.position.z);

        update();
        render();
    }

    function update(time) {
        if ( keyboard.pressed("z") )
        {
            scene.remove(root);

            root = createStructure(data, scene, depthLimit, maxChildrenPerBox);

            info.innerHTML = '<h1>' + root.name + '</h1>';

            updatePickingScene(root,pickingScene);
        }

        if ( keyboard.pressed("x") )
        {
            if(selected){
                checkSelected(selected,0.1,true,unselectColor);
                selected = null;
                info.innerHTML = '<h1>' + root.name + '</h1>';
            }
        }

        TWEEN.update(time);
        controls.update();
    }

    function render() {
        renderer.render( scene, camera );
    }

    function createStructure(data, scene, depthLimit, maxChildrenPerBox){
        depthLimit = depthLimit || 3;
        maxChildrenPerBox = maxChildrenPerBox || 50;

        // i can set the root node render order to depth limit
        // because it also denotes the number of nested levels
        var rootCube = new Box({name: data.name, order: depthLimit + 1, size: 1000, color: rainbow(4,depthLimit + 1)});
        rootCube.userData = data;

        updateBoundingBox(rootCube);
        scene.add(rootCube);

        if (data.children != null) {
            createChildStructure(rootCube, data.children, depthLimit, maxChildrenPerBox);
        }

        arrangeChildren(rootCube);

        return rootCube;

    }

    function createChildStructure(parent, children, depthLimit, maxChildrenPerBox){

        if(depthLimit === 0)
            return;

        if(children.length > maxChildrenPerBox)
            return;

        updateBoundingBox(parent);

        var childSize = Math.floor(parent.geometry.boundingBox.size().x / (children.length + 1) ) + 1;

        for(var i = 0; i < children.length; i++){
            var child = children[i];

            var childBox = createChild(parent, { name: child.name, size: childSize, order: depthLimit + 1, color: rainbow(4, depthLimit) });
            childBox.userData = child;
            if(depthLimit > 1 && child.children != null){
                cubesToIntersect.push(childBox);
                createChildStructure(childBox, child.children, depthLimit -1 , maxChildrenPerBox);
            }
        }

    }

    function onDocumentMouseClick( event ) {
        event.preventDefault();

        mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        //mouse.z = 0.5;

        renderer.render(pickingScene,camera);

        raycaster.setFromCamera( mouse, camera );

        // calculate objects intersecting the picking ray
        var intersects = raycaster.intersectObjects( pickingScene.children, true );

        for( var i = 0; i < intersects.length; i++ ) {
            var intersection = intersects[ i ],
                obj = intersection.object;

            if(selected){ checkSelected(selected,0.1, true, unselectColor) }

            selected = obj.userData;

            unselectColor.copy(selected.material.color);
            checkSelected(selected,0.1);

            info.innerHTML = "<h1>"+obj.userData.name+"</h1>";

            if(event.ctrlKey){
                scene.remove(root);
                root = createStructure(obj.userData.userData,scene, depthLimit, maxChildrenPerBox);
                updatePickingScene(root,pickingScene);
            }
        }
    }

    ////////////////////////// UTILS ///////////////////////////////////////////////////
    function checkSelected(selected, amount, uncheck, unselectColor){
        amount = amount || 0.1;
        uncheck = uncheck || false;

        if(amount > 1 || amount < 0) { amount = 0.1 }
        if(uncheck) { amount = -amount }

        var r = selected.material.color.r + amount;
        var g = selected.material.color.g + amount;
        var b = selected.material.color.b + amount;

        if(r > 1) { r = 1 }
        if(g > 1) { r = 1 }
        if(b > 1) { r = 1}

        if(r < 0) { r = 0 }
        if(g < 0) { r = 0 }
        if(b < 0) { r = 0 }

        if(uncheck) {
            if(!unselectColor) { unselectColor = new THREE.Color(r,g,b) }
            selected.material.color.copy(unselectColor);
        }
        else {
            selected.material.color.setRGB(r,g,b);
        }

    }

    function rainbow(numOfSteps, step) {
        // This function generates vibrant, "evenly spaced" colours (i.e. no clustering). This is ideal for creating easily distinguishable vibrant markers in Google Maps and other apps.
        // Adam Cole, 2011-Sept-14
        // HSV to RBG adapted from: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
        var r, g, b;
        var h = step / numOfSteps;
        var i = ~~(h * 6);
        var f = h * 6 - i;
        var q = 1 - f;
        switch(i % 6){
            case 0: r = 1, g = f, b = 0; break;
            case 1: r = q, g = 1, b = 0; break;
            case 2: r = 0, g = 1, b = f; break;
            case 3: r = 0, g = q, b = 1; break;
            case 4: r = f, g = 0, b = 1; break;
            case 5: r = 1, g = 0, b = q; break;
        }
        var c = "#" + ("00" + (~ ~(r * 255)).toString(16)).slice(-2) + ("00" + (~ ~(g * 255)).toString(16)).slice(-2) + ("00" + (~ ~(b * 255)).toString(16)).slice(-2);
        return (c);
    }

    function getRandomColor() {
        var letters = '0123456789ABCDEF'.split('');
        var color = '#';
        for (var i = 0; i < 6; i++ ) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    ////////////////////////// DEMO ///////////////////////////////////////////////////
    function demoShowCase(scene){
        mesh = new Box({size: 1000, order: 4, color: rainbow(10,1)});

        updateBoundingBox(mesh);

        var rand = Math.floor(Math.random()*60)+3;

        for(var i = 0; i < rand; ++i ) {
            var size = Math.floor(1000/rand*1.2) - 5;
            createChild(mesh, {size: size, color: rainbow(10,2), order: 3});
        }

        mesh.children.forEach(function(node){
            var rand = Math.floor(Math.random()*300)+300;
            var size = Math.floor(node.geometry.boundingBox.size().x / rand * 1.2);

            if(rand < 50)
                for(var i = 0 ; i< rand; i++){
                    createChild(node,{size: size, color: rainbow(10,3)});
                }
        });

        scene.add( mesh );
    }

    init();
    animate();
};
