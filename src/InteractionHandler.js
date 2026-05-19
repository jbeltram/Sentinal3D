import * as THREE from 'three';

export class InteractionHandler {
  constructor(scene, renderer, camera, controls, graphEngine, vrInterface) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.controls = controls;
    this.graphEngine = graphEngine;
    this.vrInterface = vrInterface;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Desktop dragging state
    this.draggedNode = null;
    this.dragPlane = new THREE.Plane();
    this.dragIntersection = new THREE.Vector3();
    this.dragPlaneNormal = new THREE.Vector3();
    
    // HTML Elements for Desktop UI
    this.tooltipEl = document.getElementById('tooltip');
    this.inspectDetailsEl = document.getElementById('inspector-details');
    this.inspectPlaceholderEl = document.getElementById('inspector-placeholder');
    this.searchEl = document.getElementById('search-input');
    this.searchResultsEl = document.getElementById('search-results');

    // VR Controllers
    this.controllers = [];
    this.setupVRControllers();

    // Bind desktop events
    this.setupDesktopInteractions();
    
    // Bind search functionality
    this.setupSearch();

    // Bind Unpin Button
    document.getElementById('btn-desktop-unpin').addEventListener('click', () => {
      if (this.graphEngine.selectedObject) {
        const node = this.graphEngine.selectedObject.userData;
        if (node && node.type === 'node') {
          node.isPinned = false;
          this.inspectObjectOnDesktop(node);
          this.vrInterface.drawDetailsCard(node);
        }
      }
    });

    // Sync VR Unpinned actions to Desktop UI
    document.addEventListener('node-unpinned', (e) => {
      const node = e.detail;
      node.isPinned = false;
      if (this.graphEngine.selectedObject && this.graphEngine.selectedObject.userData.id === node.id) {
        this.inspectObjectOnDesktop(node);
      }
    });
  }

  // Initialize WebXR controller bindings and laser pointer rays
  setupVRControllers() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      
      controller.addEventListener('selectstart', (e) => this.onSelectStartVR(e));
      controller.addEventListener('selectend', (e) => this.onSelectEndVR(e));
      controller.addEventListener('connected', (e) => this.onControllerConnected(e, controller));
      controller.addEventListener('disconnected', (e) => this.onControllerDisconnected(e, controller));
      
      this.scene.add(controller);
      this.controllers.push(controller);

      // Create laser ray cylinder
      const laserGeom = new THREE.CylinderGeometry(0.0015, 0.0015, 5, 6);
      // Rotate cylinder so height lies along Z-axis (pointing forward)
      laserGeom.rotateX(Math.PI / 2);
      laserGeom.translate(0, 0, -2.5); // Offset so origin is at controller
      
      const laserMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const laser = new THREE.Mesh(laserGeom, laserMat);
      laser.name = 'laser';
      laser.visible = false;
      controller.add(laser);

      // Controller Handle mesh (cyber style, no external asset needed)
      const handleGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
      handleGeom.rotateX(Math.PI / 2);
      const handleMat = new THREE.MeshStandardMaterial({
        color: 0x222533,
        roughness: 0.4,
        metalness: 0.8
      });
      const handle = new THREE.Mesh(handleGeom, handleMat);
      handle.name = 'handle';
      handle.visible = false;
      controller.add(handle);

      // Intersect cursor marker
      const cursorGeom = new THREE.RingGeometry(0.01, 0.015, 16);
      const cursorMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const cursor = new THREE.Mesh(cursorGeom, cursorMat);
      cursor.name = 'cursor';
      cursor.visible = false;
      this.scene.add(cursor);
      
      controller.userData = {
        selected: null,
        cursor: cursor,
        laser: laser,
        handle: handle,
        active: false
      };
    }
  }

  onControllerConnected(event, controller) {
    controller.userData.active = true;
    controller.userData.laser.visible = true;
    controller.userData.handle.visible = true;
    controller.inputSource = event.data; // Store the XRInputSource to access Gamepad inputs
    
    // Update stats or connection displays
    this.updateStatsDisplay();
  }

  onControllerDisconnected(event, controller) {
    controller.userData.active = false;
    controller.userData.laser.visible = false;
    controller.userData.handle.visible = false;
    controller.userData.cursor.visible = false;
    
    // Drop any selected node back into graphGroup
    if (controller.userData.selected) {
      const nodeMesh = controller.userData.selected;
      this.graphEngine.graphGroup.attach(nodeMesh);
      nodeMesh.userData.isDragged = false;
      controller.userData.selected = null;
    }

    if (controller.userData.isPanning) {
      controller.userData.isPanning = false;
    }
  }

  // VR Select Start (Trigger pull down)
  onSelectStartVR(event) {
    const controller = event.target;
    const intersections = this.getVRIntersections(controller);

    if (intersections.length > 0) {
      const hit = intersections[0];
      const obj = hit.object;
      const data = obj.userData;

      // 1. Raycast UI Check
      if (obj.name === 'VR_Control_Panel' || obj.name === 'VR_Details_Card') {
        this.vrInterface.handleRaycast(hit, true);
        return;
      }

      // 2. Click Node
      if (data && data.type === 'node') {
        this.graphEngine.selectObject(obj);
        
        // Start dragging node
        controller.attach(obj);
        data.isDragged = true;
        controller.userData.selected = obj;
        
        // Show info card at node position in local graphGroup coordinates
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);
        const localPos = worldPos.clone();
        this.graphEngine.graphGroup.worldToLocal(localPos);
        
        this.vrInterface.showDetailsCard(data, localPos);
        this.inspectObjectOnDesktop(data);
      } 
      // 3. Click Edge
      else if (data && data.type === 'edge') {
        this.graphEngine.selectObject(obj);
        
        // Convert hit point to local graphGroup coordinates
        const localHitPoint = hit.point.clone();
        this.graphEngine.graphGroup.worldToLocal(localHitPoint);
        
        // Show info card at hit point
        this.vrInterface.showDetailsCard(data, localHitPoint);
        this.inspectObjectOnDesktop(data);
      }
    } else {
      // Clicked on empty space: start panning/dragging the scene!
      controller.userData.isPanning = true;
      controller.userData.panStartControllerPos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
      controller.userData.panStartGroupPos = this.graphEngine.graphGroup.position.clone();
    }
  }

  // VR Select End (Trigger release)
  onSelectEndVR(event) {
    const controller = event.target;
    
    if (controller.userData.isPanning) {
      controller.userData.isPanning = false;
      return;
    }

    const draggedObj = controller.userData.selected;

    if (draggedObj) {
      // Release node back to graphGroup
      this.graphEngine.graphGroup.attach(draggedObj);
      draggedObj.userData.isDragged = false;
      draggedObj.userData.isPinned = true; // Pin it in space
      controller.userData.selected = null;

      // Refresh graph selection and reposition info card
      this.vrInterface.showDetailsCard(draggedObj.userData, draggedObj.position);
      this.inspectObjectOnDesktop(draggedObj.userData);
    }
  }

  // Intersect helper for VR controllers
  getVRIntersections(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);
    
    this.raycaster.set(origin, direction);
    
    const targets = [
      ...this.graphEngine.nodes.map(n => n.mesh),
      ...this.graphEngine.links.map(l => l.mesh),
      this.vrInterface.panelMesh,
      this.vrInterface.cardMesh
    ].filter(mesh => mesh.visible);

    return this.raycaster.intersectObjects(targets);
  }

  // Main frame updates for VR pointers, cursors, hovers, and panning/joystick inputs
  updateVRInteractions() {
    this.controllers.forEach(controller => {
      if (!controller.userData.active) return;

      // 1. If controller is panning, update group position and skip raycasting
      if (controller.userData.isPanning) {
        const currentPos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
        const delta = new THREE.Vector3().subVectors(currentPos, controller.userData.panStartControllerPos);
        // Amplify the hand movement for panning by 4.5x so it shifts a lot more dynamically
        delta.multiplyScalar(4.5);
        this.graphEngine.graphGroup.position.copy(controller.userData.panStartGroupPos).add(delta);
        
        controller.userData.cursor.visible = false;
        controller.userData.laser.scale.z = 1.0;
        controller.userData.laser.material.color.setHex(0x3b82f6); // Deep blue when panning
        return;
      }

      // 2. Read Joystick Inputs for rotation and dolly zoom (translation)
      if (controller.inputSource && controller.inputSource.gamepad) {
        const axes = controller.inputSource.gamepad.axes;
        const joystickX = axes[2] || 0; // thumbstick X axis (horizontal)
        const joystickY = axes[3] || 0; // thumbstick Y axis (vertical)

        if (Math.abs(joystickX) > 0.15) {
          // Rotate around the visual VR center of the graph (comfortable center position: 0, 1.5, -1.5)
          const rotationSpeed = joystickX * 0.02;
          const center = this.graphEngine.center;
          
          this.graphEngine.graphGroup.position.sub(center);
          this.graphEngine.graphGroup.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotationSpeed);
          this.graphEngine.graphGroup.position.add(center);
          this.graphEngine.graphGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -rotationSpeed);
        }

        if (Math.abs(joystickY) > 0.15) {
          // Tractor Beam Zoom: translate graphGroup along this controller's laser ray direction!
          // Point at a cluster and push UP to pull it directly towards your hand, or DOWN to push it away.
          const zoomSpeed = 0.04;
          
          const tempMatrix = new THREE.Matrix4();
          tempMatrix.identity().extractRotation(controller.matrixWorld);
          const rayDirection = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);
          rayDirection.normalize();
          
          // Pushing UP (negative in standard WebXR) translates the scene closer (-rayDirection)
          this.graphEngine.graphGroup.position.addScaledVector(rayDirection, joystickY * zoomSpeed);
        }
      }

      // 3. Normal raycasting checks
      const intersections = this.getVRIntersections(controller);
      const cursor = controller.userData.cursor;
      const laser = controller.userData.laser;

      if (intersections.length > 0) {
        const hit = intersections[0];
        const obj = hit.object;
        const data = obj.userData;

        // Position cursor at intersection point, facing controller
        cursor.position.copy(hit.point);
        cursor.lookAt(new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld));
        cursor.visible = true;

        // Adjust laser length to end at hit point
        laser.scale.z = hit.distance / 5.0; // Base laser is 5 units long

        // Handle hovers
        if (obj.name === 'VR_Control_Panel' || obj.name === 'VR_Details_Card') {
          const cursorType = this.vrInterface.handleRaycast(hit, false);
          laser.material.color.setHex(cursorType === 'pointer' ? 0x10b981 : 0x3b82f6);
          this.graphEngine.hoverObject(null);
        } else {
          laser.material.color.setHex(0x3b82f6);
          this.vrInterface.clearHoverStates();
          this.graphEngine.hoverObject(obj);
        }
      } else {
        // Reset pointers
        cursor.visible = false;
        laser.scale.z = 1.0;
        laser.material.color.setHex(0x3b82f6);
        this.vrInterface.clearHoverStates();
        
        // If we were hovering the graph engine objects, reset hover styling
        if (this.graphEngine.hoveredObject && 
            this.graphEngine.hoveredObject !== this.graphEngine.selectedObject &&
            this.graphEngine.hoveredObject.name !== 'VR_Control_Panel' &&
            this.graphEngine.hoveredObject.name !== 'VR_Details_Card') {
          this.graphEngine.hoverObject(null);
        }
      }
    });
  }

  // --- DESKTOP INTERACTION METHODS ---
  
  setupDesktopInteractions() {
    const container = document.getElementById('canvas-container');

    // Record Mouse Coordinates
    container.addEventListener('mousemove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Call hover and drag updates
      this.onDesktopMouseMove(e);
    });

    container.addEventListener('mousedown', (e) => this.onDesktopMouseDown(e));
    window.addEventListener('mouseup', () => this.onDesktopMouseUp());
  }

  onDesktopMouseDown(event) {
    // Only drag with left click
    if (event.button !== 0) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = [
      ...this.graphEngine.nodes.map(n => n.mesh),
      ...this.graphEngine.links.map(l => l.mesh),
      this.vrInterface.cardMesh
    ].filter(mesh => mesh.visible);

    const intersects = this.raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const obj = hit.object;

      // Click VR details card close button via desktop mouse
      if (obj.name === 'VR_Details_Card') {
        this.vrInterface.handleRaycast(hit, true);
        return;
      }

      const data = obj.userData;
      this.graphEngine.selectObject(obj);

      if (data && data.type === 'node') {
        this.draggedNode = data;
        
        // Define virtual drag plane parallel to camera viewport passing through node position
        this.camera.getWorldDirection(this.dragPlaneNormal);
        this.dragPlaneNormal.negate(); // Faces camera
        this.dragPlane.setFromNormalAndCoplanarPoint(this.dragPlaneNormal, obj.position);
        
        // Disable OrbitControls so camera doesn't rotate while dragging
        this.controls.enabled = false;
        data.isDragged = true;

        // Show 3D card & desktop details panel
        this.vrInterface.showDetailsCard(data, obj.position);
        this.inspectObjectOnDesktop(data);
      } else if (data && data.type === 'edge') {
        // Select edge
        this.vrInterface.showDetailsCard(data, hit.point);
        this.inspectObjectOnDesktop(data);
      }
    } else {
      // Clicked on empty space: clear selections & hide card
      this.graphEngine.selectObject(null);
      this.vrInterface.hideDetailsCard();
      this.clearDesktopInspector();
    }
  }

  onDesktopMouseMove(event) {
    // 1. Handle Active Node Dragging
    if (this.draggedNode) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection)) {
        // Convert world dragIntersection to local coordinates of graphGroup
        const localIntersection = this.dragIntersection.clone();
        this.graphEngine.graphGroup.worldToLocal(localIntersection);
        
        this.draggedNode.mesh.position.copy(localIntersection);
        
        // Constrain bounding box so nodes don't fly off screen (clamped in local coordinates)
        this.draggedNode.mesh.position.clamp(
          new THREE.Vector3(-4, 0.1, -5),
          new THREE.Vector3(4, 3.5, 1)
        );

        // Reposition 3D Details Card dynamically during dragging
        this.vrInterface.showDetailsCard(this.draggedNode, this.draggedNode.mesh.position);
      }
      return;
    }

    // 2. Hover Interactions
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = [
      ...this.graphEngine.nodes.map(n => n.mesh),
      ...this.graphEngine.links.map(l => l.mesh),
      this.vrInterface.cardMesh
    ].filter(mesh => mesh.visible);

    const intersects = this.raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const obj = hit.object;
      const data = obj.userData;

      // Hover on details card
      if (obj.name === 'VR_Details_Card') {
        const cursorType = this.vrInterface.handleRaycast(hit, false);
        document.body.style.cursor = cursorType;
        this.graphEngine.hoverObject(null);
        this.hideTooltip();
        return;
      }

      document.body.style.cursor = 'pointer';

      if (data) {
        this.graphEngine.hoverObject(obj);
        
        // Show HTML desktop tooltip
        const label = data.type === 'node' ? data.name : `Link: ${data.source.name} ↔ ${data.target.name}`;
        this.showTooltip(label, event.clientX, event.clientY);
      }
    } else {
      document.body.style.cursor = 'default';
      this.graphEngine.hoverObject(null);
      this.hideTooltip();
    }
  }

  onDesktopMouseUp() {
    if (this.draggedNode) {
      this.draggedNode.isDragged = false;
      this.draggedNode.isPinned = true; // Pin it in space
      
      const finishedNode = this.draggedNode;
      this.draggedNode = null;
      this.controls.enabled = true; // Re-enable OrbitControls

      // Refresh selection details showing Pinned state
      this.inspectObjectOnDesktop(finishedNode);
      this.vrInterface.showDetailsCard(finishedNode, finishedNode.mesh.position);
    }
  }

  // Tooltip UI utilities
  showTooltip(text, x, y) {
    this.tooltipEl.textContent = text;
    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
    this.tooltipEl.style.display = 'block';
  }

  hideTooltip() {
    this.tooltipEl.style.display = 'none';
  }

  // Populate desktop sidebar inspector fields
  inspectObjectOnDesktop(data) {
    this.inspectPlaceholderEl.style.display = 'none';
    this.inspectDetailsEl.style.display = 'flex';

    document.getElementById('inspect-id').textContent = data.id;
    document.getElementById('inspect-desc').textContent = data.description;

    const nodeSpecific = document.getElementById('inspect-node-specific');
    const edgeSpecific = document.getElementById('inspect-edge-specific');
    const typeBadge = document.getElementById('inspect-type');
    const pinnedRow = document.getElementById('inspect-pinned-row');
    const unpinBtn = document.getElementById('btn-desktop-unpin');

    if (data.type === 'node') {
      typeBadge.textContent = 'Node';
      typeBadge.className = 'badge badge-node';
      
      nodeSpecific.style.display = 'block';
      edgeSpecific.style.display = 'none';

      document.getElementById('inspect-name').textContent = data.name;
      document.getElementById('inspect-connections').textContent = `${data.connections} channels`;
      document.getElementById('inspect-group').textContent = this.graphEngine.groups[data.group].name;

      if (data.isPinned) {
        pinnedRow.style.display = 'flex';
        unpinBtn.style.display = 'block';
      } else {
        pinnedRow.style.display = 'none';
        unpinBtn.style.display = 'none';
      }
    } else {
      typeBadge.textContent = 'Link';
      typeBadge.className = 'badge badge-edge';

      nodeSpecific.style.display = 'none';
      edgeSpecific.style.display = 'block';
      
      pinnedRow.style.display = 'none';
      unpinBtn.style.display = 'none';

      document.getElementById('inspect-name').textContent = 'Link Channel';
      document.getElementById('inspect-source').textContent = data.source.name;
      document.getElementById('inspect-target').textContent = data.target.name;
    }
  }

  clearDesktopInspector() {
    this.inspectPlaceholderEl.style.display = 'block';
    this.inspectDetailsEl.style.display = 'none';
    document.getElementById('inspect-pinned-row').style.display = 'none';
    document.getElementById('btn-desktop-unpin').style.display = 'none';
  }

  updateStatsDisplay() {
    document.getElementById('stats-nodes').textContent = this.graphEngine.nodes.length;
    document.getElementById('stats-edges').textContent = this.graphEngine.links.length;
  }

  // --- SEARCH UTILITIES ---

  setupSearch() {
    this.searchEl.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        this.searchResultsEl.style.display = 'none';
        return;
      }

      const matches = this.graphEngine.nodes.filter(n => 
        n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
      ).slice(0, 5);

      if (matches.length > 0) {
        this.searchResultsEl.innerHTML = '';
        matches.forEach(node => {
          const item = document.createElement('div');
          item.className = 'search-item';
          item.textContent = `${node.name} (${this.graphEngine.groups[node.group].name})`;
          item.addEventListener('click', () => {
            // Select and zoom camera to node
            this.graphEngine.selectObject(node.mesh);
            this.vrInterface.showDetailsCard(node, node.mesh.position);
            this.inspectObjectOnDesktop(node);
            
            // Move OrbitControls target to node
            const targetPos = node.mesh.position.clone();
            this.controls.target.copy(targetPos);
            
            // Adjust camera position to frame node nicely
            const camOffset = new THREE.Vector3(0, 0.5, 1.2);
            this.camera.position.copy(targetPos).add(camOffset);
            this.controls.update();

            this.searchResultsEl.style.display = 'none';
            this.searchEl.value = node.name;
          });
          this.searchResultsEl.appendChild(item);
        });
        this.searchResultsEl.style.display = 'block';
      } else {
        this.searchResultsEl.style.display = 'none';
      }
    });

    // Dismiss search results when clicking away
    document.addEventListener('click', (e) => {
      if (e.target !== this.searchEl && e.target !== this.searchResultsEl) {
        this.searchResultsEl.style.display = 'none';
      }
    });
  }
}
