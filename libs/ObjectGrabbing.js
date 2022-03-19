const ObjectGrabbing = function (camera, scene, world, bodies, meshes, limits) {
    var raycaster = new THREE.Raycaster();

    let constraintDown = false;
    let lastX, lastY;

    var gIso=false, clickMarker=false
    var jointBody, constrainedBody, mouseConstraint;

    const gplaneMaterial = new THREE.MeshLambertMaterial( { side: THREE.BackSide } ),
        markerMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } );

    const onMouseMove = function (e) {
        // Should be consolidated to updateConstraint()
        // Move and project on the plane
        lastX = e.clientX;
        lastY = e.clientY;
        if (gIso && mouseConstraint) {
            var pos = projectFromCamera(camera);
            if (pos){
                setClickMarker(pos);
                moveJointToPoint(pos);
            }
        }
    };

    const onMouseDown = function () {
        // Find mesh from a ray
        const entity = findNearestIntersectingObject(camera, meshes);
        const pos = entity.point;
        if (pos && entity.object.geometry instanceof THREE.BoxGeometry){
            constraintDown = true;
            // Set marker on contact point
            setClickMarker(pos);

            // Set the movement plane
            setScreenPerpCenter(pos,camera);

            const idx = meshes.indexOf(entity.object);
            if(idx !== -1){
                addMouseConstraint(pos.x,pos.y,pos.z,bodies[idx]);
            }
        }
    };

    const onMouseUp = function () {
        constraintDown = false;
        // remove the marker
        clickMarker.visible = false;

        // Send the remove mouse joint to server
        removeJointConstraint();
    };

    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('mousedown', onMouseDown, false );
    document.addEventListener('mouseup', onMouseUp, false );

    this.initCannon = function () {
        var shape = new CANNON.Sphere(0.1);
        jointBody = new CANNON.Body({ mass: 0 });
        jointBody.addShape(shape);
        jointBody.collisionFilterGroup = 0;
        jointBody.collisionFilterMask = 0;
        world.addBody(jointBody);
    }

    this.update = function () {
        if (gIso) {
            // Center plane at camera position
            gIso.position.copy(camera.position);
            if (constraintDown) {
                const pos = projectFromCamera(camera);
                if(pos){
                    setClickMarker(pos);
                    moveJointToPoint(pos);
                }
            }
        }
    }

    function setClickMarker(pos) {
        if(!clickMarker){
            const shape = new THREE.SphereGeometry(0.2, 8, 8);
            clickMarker = new THREE.Mesh(shape, markerMaterial);
            scene.add(clickMarker);
        }
        clickMarker.visible = true;
        clickMarker.position.copy(pos);
    }

    function setScreenPerpCenter(point, camera) {
        // If it does not exist, create a new one
        const isoGeo = new THREE.IcosahedronGeometry(camera.position.distanceTo(point), 4);
        if(!gIso) {
            const plane = gIso = new THREE.Mesh(isoGeo, gplaneMaterial);
            plane.visible = false; // Hide it..
            scene.add(gIso);
            limits.push(gIso);
            return;
        }
        gIso.geometry.dispose();
        gIso.geometry = isoGeo;
    }

    function findNearestIntersectingObject(camera, objects) {
        // Get the picking ray from the point
        raycaster.setFromCamera(new THREE.Vector2(), camera);

        // Find the closest intersecting object
        // Now, cast the ray all render objects in the scene to see if they collide. Take the closest one.
        var hits = raycaster.intersectObjects(objects);
        var closest = false;
        if (hits.length > 0 /*&& hits[0].distance < 8*/) {
            closest = hits[0];
        }

        return closest;
    }

    function projectFromCamera(camera) {
        // Get the picking ray from the point
        raycaster.setFromCamera(new THREE.Vector2(), camera);
        var hits = raycaster.intersectObjects(limits);


        if (hits.length > 0 && hits[0].object.geometry instanceof THREE.IcosahedronGeometry)
            return hits[0].point;
        return false;
    }

    function addMouseConstraint(x,y,z,body) {
        // The cannon body constrained by the mouse joint
        constrainedBody = body;

        // Vector to the clicked point, relative to the body
        var v1 = new CANNON.Vec3(x,y,z).vsub(constrainedBody.position);

        // Apply anti-quaternion to vector to tranform it into the local body coordinate system
        var antiRot = constrainedBody.quaternion.inverse();
        var pivot = antiRot.vmult(v1); // pivot is not in local body coordinates

        // Move the cannon click marker particle to the click position
        jointBody.position.set(x,y,z);

        // Create a new constraint
        // The pivot for the jointBody is zero
        mouseConstraint = new CANNON.PointToPointConstraint(constrainedBody, pivot, jointBody, new CANNON.Vec3(0,0,0));

        // Add the constriant to world
        world.addConstraint(mouseConstraint);
    }

    // This functions moves the transparent joint body to a new postion in space
    function moveJointToPoint(pos) {
        // Move the joint body to a new position
        jointBody.position.copy(pos);
        mouseConstraint.update();
    }

    function removeJointConstraint(){
        // Remove constriant from world
        world.removeConstraint(mouseConstraint);
        mouseConstraint = false;
    }
};