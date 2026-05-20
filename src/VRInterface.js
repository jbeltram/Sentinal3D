import * as THREE from 'three';

export class VRInterface {
  constructor(scene, graphEngine) {
    this.scene = scene;
    this.graphEngine = graphEngine;
    
    // Physics toggle state (shared with main.js)
    this.physicsEnabled = true;

    // 1. Details Card Setup (for inspecting nodes/edges)
    this.cardCanvas = document.createElement('canvas');
    this.cardCanvas.width = 512;
    this.cardCanvas.height = 384;
    this.cardCtx = this.cardCanvas.getContext('2d');
    
    this.cardTexture = new THREE.CanvasTexture(this.cardCanvas);
    this.cardMaterial = new THREE.MeshBasicMaterial({
      map: this.cardTexture,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide
    });
    this.cardGeometry = new THREE.PlaneGeometry(0.8, 0.6);
    this.cardMesh = new THREE.Mesh(this.cardGeometry, this.cardMaterial);
    this.cardMesh.position.set(0, -10, 0); // Hide initially below scene
    this.cardMesh.visible = false;
    this.cardMesh.name = 'VR_Details_Card';
    this.graphEngine.graphGroup.add(this.cardMesh);

    // Interactive button boundaries on Details Card (relative to canvas pixels)
    this.cardCloseBtn = { x: 440, y: 15, w: 55, h: 30 };
    this.cardUnpinBtn = { x: 340, y: 15, w: 85, h: 30 };
    this.unpinBtnHovered = false;
    this.cardData = null;

    // 2. Control Panel Setup (floating desk in front of user)
    this.panelCanvas = document.createElement('canvas');
    this.panelCanvas.width = 512;
    this.panelCanvas.height = 320;
    this.panelCtx = this.panelCanvas.getContext('2d');
    
    this.panelTexture = new THREE.CanvasTexture(this.panelCanvas);
    this.panelMaterial = new THREE.MeshBasicMaterial({
      map: this.panelTexture,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    this.panelGeometry = new THREE.PlaneGeometry(0.9, 0.56);
    this.panelMesh = new THREE.Mesh(this.panelGeometry, this.panelMaterial);
    
    // Position control panel at comfortable desk height (Y=0.9, Z=-0.8) and angle
    this.panelMesh.position.set(0, 0.9, -0.9);
    this.panelMesh.rotation.set(-Math.PI / 6, 0, 0); // Angle tilted towards viewer
    this.panelMesh.name = 'VR_Control_Panel';
    this.scene.add(this.panelMesh);

    // Interactive button definitions on Control Panel (Professional Palette)
    this.panelButtons = [
      {
        id: 'reset_layout',
        label: 'Reset Layout',
        x: 40,
        y: 110,
        w: 432,
        h: 45,
        color: '#3b82f6',
        hovered: false,
        action: () => this.graphEngine.resetLayout()
      },
      {
        id: 'regenerate',
        label: 'Regenerate Graph',
        x: 40,
        y: 170,
        w: 432,
        h: 45,
        color: '#4f46e5',
        hovered: false,
        action: () => {
          this.graphEngine.generateRandomGraph(25, 40);
          this.hideDetailsCard();
        }
      },
      {
        id: 'toggle_physics',
        label: 'Physics Simulation: ON',
        x: 40,
        y: 230,
        w: 432,
        h: 45,
        color: '#10b981',
        hovered: false,
        action: () => {
          this.physicsEnabled = !this.physicsEnabled;
          this.updatePhysicsButton();
        }
      }
    ];

    // Initialize drawings
    this.drawControlPanel();
    this.drawDetailsCard(null);
  }

  // Draw the Control Panel UI canvas (Professional Minimal Theme)
  drawControlPanel() {
    const ctx = this.panelCtx;
    const w = this.panelCanvas.width;
    const h = this.panelCanvas.height;

    // Clear and draw background
    ctx.clearRect(0, 0, w, h);
    
    // Panel base (solid dark charcoal)
    ctx.fillStyle = '#111827';
    this.drawRoundedRect(ctx, 0, 0, w, h, 12, true, false);

    // Panel border (subtle gray)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, 1, 1, w - 2, h - 2, 11, false, true);

    // Header Text
    ctx.fillStyle = '#f9fafb';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SENTINAL3D CONSOLE', w / 2, 24);

    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px Arial, sans-serif';
    ctx.fillText('ENTERPRISE VR CONTROL HUB', w / 2, 54);

    // Draw buttons
    this.panelButtons.forEach(btn => {
      // Button background
      ctx.fillStyle = btn.hovered ? '#1f2937' : '#1e293b';
      ctx.strokeStyle = btn.hovered ? '#3b82f6' : '#334155';
      ctx.lineWidth = 1.5;
      this.drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 6, true, true);

      // Button label
      ctx.fillStyle = btn.hovered ? '#3b82f6' : '#f9fafb';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label.toUpperCase(), btn.x + btn.w / 2, btn.y + btn.h / 2);
    });

    this.panelTexture.needsUpdate = true;
  }

  // Update layout state text on button dynamically
  updatePhysicsButton() {
    const btn = this.panelButtons.find(b => b.id === 'toggle_physics');
    if (btn) {
      btn.label = `Physics Simulation: ${this.physicsEnabled ? 'ON' : 'OFF'}`;
      btn.color = this.physicsEnabled ? '#10b981' : '#ef4444';
      this.drawControlPanel();
    }
  }

  // Draw Details Card canvas content (Professional Minimal Theme)
  drawDetailsCard(data) {
    this.cardData = data; // Cache references to check clicks
    const ctx = this.cardCtx;
    const w = this.cardCanvas.width;
    const h = this.cardCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!data) return;

    const isNode = data.type === 'node';
    const accentColor = isNode ? '#3b82f6' : '#818cf8';

    // Base background (solid dark charcoal)
    ctx.fillStyle = '#111827';
    this.drawRoundedRect(ctx, 0, 0, w, h, 12, true, false);

    // Border (subtle gray)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, 1, 1, w - 2, h - 2, 11, false, true);

    // Badge (NODE / LINK)
    ctx.fillStyle = accentColor;
    this.drawRoundedRect(ctx, 24, 24, 70, 22, 4, true, false);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isNode ? 'NODE' : 'LINK', 59, 35);

    // Pinned status badge
    if (isNode && data.isPinned) {
      ctx.fillStyle = '#ef4444';
      this.drawRoundedRect(ctx, 102, 24, 75, 22, 4, true, false);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillText('PINNED', 139, 35);
    }

    // Close Button at top right
    const cb = this.cardCloseBtn;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5;
    this.drawRoundedRect(ctx, cb.x, cb.y, cb.w, cb.h, 4, true, true);
    
    ctx.fillStyle = '#f9fafb';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLOSE', cb.x + cb.w / 2, cb.y + cb.h / 2);

    // Unpin Button if node is pinned
    if (isNode && data.isPinned) {
      const ub = this.cardUnpinBtn;
      ctx.fillStyle = this.unpinBtnHovered ? '#b91c1c' : '#991b1b';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      this.drawRoundedRect(ctx, ub.x, ub.y, ub.w, ub.h, 4, true, true);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UNPIN', ub.x + ub.w / 2, ub.y + ub.h / 2);
    }

    // Title / ID
    ctx.fillStyle = '#f9fafb';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(isNode ? data.name : 'Data link connection', 24, 62);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(`ID: ${data.id}`, 24, 90);

    // Divider Line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 110);
    ctx.lineTo(w - 24, 110);
    ctx.stroke();

    // Group / Stats details
    let yPos = 125;
    ctx.fillStyle = '#f9fafb';
    ctx.font = '13px Arial, sans-serif';

    if (isNode) {
      const groupData = this.graphEngine.groups[data.group];
      ctx.fillText(`System Cluster: `, 24, yPos);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(groupData.name, 140, yPos);
      
      yPos += 22;
      ctx.fillStyle = '#f9fafb';
      ctx.fillText(`Active Links: `, 24, yPos);
      ctx.fillStyle = '#10b981';
      ctx.fillText(`${data.connections} channels`, 140, yPos);
    } else {
      ctx.fillText(`Source Node: `, 24, yPos);
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(data.source.name, 140, yPos);

      yPos += 22;
      ctx.fillStyle = '#f9fafb';
      ctx.fillText(`Target Node: `, 24, yPos);
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(data.target.name, 140, yPos);
    }

    yPos += 30;
    // Description text-wrapped paragraph
    ctx.fillStyle = '#9ca3af';
    ctx.font = '13px Arial, sans-serif';
    this.wrapText(ctx, data.description, 24, yPos, w - 48, 18);

    this.cardTexture.needsUpdate = true;
  }

  // Show details card positioned near selected node/edge
  showDetailsCard(data, position) {
    this.drawDetailsCard(data);
    
    // Position card slightly offset from clicked mesh
    this.cardMesh.position.copy(position).add(new THREE.Vector3(0, 0.35, 0));
    this.cardMesh.visible = true;
  }

  hideDetailsCard() {
    this.cardMesh.visible = false;
    this.cardMesh.position.set(0, -10, 0); // Hide
    this.graphEngine.selectObject(null);
  }

  // Update card position to follow node/edge in real-time, and billboard to face camera
  update(cameraPosition, selectedMesh) {
    if (this.cardMesh.visible) {
      if (selectedMesh) {
        // Offset card slightly above node or edge midpoint
        this.cardMesh.position.copy(selectedMesh.position).add(new THREE.Vector3(0, 0.35, 0));
      }
      // Look at camera in horizontal plane to prevent neck twisting rotations
      const targetPos = new THREE.Vector3(cameraPosition.x, this.cardMesh.position.y, cameraPosition.z);
      this.cardMesh.lookAt(targetPos);
    }
  }

  // Handle raycast intersections from controller laser pointers
  // Triggers hovered styles or executes click callbacks
  handleRaycast(intersection, isClick) {
    const meshName = intersection.object.name;
    const uv = intersection.uv;
    if (!uv) return;

    const pixelX = uv.x * 512;
    const pixelY = (1 - uv.y) * (meshName === 'VR_Control_Panel' ? 320 : 384);

    if (meshName === 'VR_Control_Panel') {
      let redrawNeeded = false;

      this.panelButtons.forEach(btn => {
        const isHover = (pixelX >= btn.x && pixelX <= btn.x + btn.w && pixelY >= btn.y && pixelY <= btn.y + btn.h);
        
        if (isHover !== btn.hovered) {
          btn.hovered = isHover;
          redrawNeeded = true;
        }

        if (isHover && isClick) {
          btn.action();
        }
      });

      if (redrawNeeded) {
        this.drawControlPanel();
      }
      return 'pointer';
    } 
    
    if (meshName === 'VR_Details_Card') {
      const cb = this.cardCloseBtn;
      const ub = this.cardUnpinBtn;

      const isCloseHover = (pixelX >= cb.x && pixelX <= cb.x + cb.w && pixelY >= cb.y && pixelY <= cb.y + cb.h);
      
      const hasUnpin = this.cardData && this.cardData.type === 'node' && this.cardData.isPinned;
      const isUnpinHover = hasUnpin && (pixelX >= ub.x && pixelX <= ub.x + ub.w && pixelY >= ub.y && pixelY <= ub.y + ub.h);

      let redrawNeeded = false;
      if (isUnpinHover !== this.unpinBtnHovered) {
        this.unpinBtnHovered = isUnpinHover;
        redrawNeeded = true;
      }
      
      if (redrawNeeded) {
        this.drawDetailsCard(this.cardData);
      }

      if (isClick) {
        if (isCloseHover) {
          this.hideDetailsCard();
        } else if (isUnpinHover) {
          this.cardData.isPinned = false;
          // Dispatch event to sync desktop view
          document.dispatchEvent(new CustomEvent('node-unpinned', { detail: this.cardData }));
          this.drawDetailsCard(this.cardData);
        }
      }

      return (isCloseHover || isUnpinHover) ? 'pointer' : 'default';
    }

    return 'default';
  }

  // Helper to clear hovers on panel when ray leaves it
  clearHoverStates() {
    let redrawNeeded = false;
    this.panelButtons.forEach(btn => {
      if (btn.hovered) {
        btn.hovered = false;
        redrawNeeded = true;
      }
    });
    if (redrawNeeded) {
      this.drawControlPanel();
    }
  }

  // Canvas utility for drawing rounded rectangles
  drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // Canvas utility for wrapping paragraph text
  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }
}
