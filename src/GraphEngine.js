import * as THREE from 'three';

export class GraphEngine {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
    this.links = [];
    
    // Group container for entire graph (to allow scaling, panning, and rotating)
    this.graphGroup = new THREE.Group();
    this.scene.add(this.graphGroup);
    
    // Group definitions for visual aesthetics
    this.groups = [
      { id: 0, name: 'Compute Core', color: 0x00f0ff, desc: 'Central processing nodes handling active queries.' },
      { id: 1, name: 'Neural Network', color: 0xd600ff, desc: 'Synaptic nodes processing logic weights and inference.' },
      { id: 2, name: 'Database Cluster', color: 0x39ff14, desc: 'Storage nodes containing raw transactional data.' },
      { id: 3, name: 'Gateway Interface', color: 0xffb800, desc: 'Entry points connecting external requests to the core.' }
    ];

    // Shared geometries to save memory
    this.nodeGeometry = new THREE.SphereGeometry(0.12, 32, 32);
    // Base cylinder geometry pointing along Y, height = 1, centered at origin
    this.edgeGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1, 8);
    
    // Center point of the graph in space (comfortable eye-level height in VR)
    this.center = new THREE.Vector3(0, 1.5, -1.5);
    
    // Keep track of hover and selection states
    this.hoveredObject = null;
    this.selectedObject = null;
  }

  // Generate a random graph with node clusters
  generateRandomGraph(nodeCount = 25, edgeCount = 40) {
    this.clearGraph();

    // 1. Create nodes
    for (let i = 0; i < nodeCount; i++) {
      const groupIdx = i % this.groups.length;
      const group = this.groups[groupIdx];
      
      // Position nodes randomly within a sphere around the VR center
      const radius = 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const x = this.center.x + radius * Math.sin(phi) * Math.cos(theta);
      const y = this.center.y + radius * Math.sin(phi) * Math.sin(theta);
      const z = this.center.z + radius * Math.cos(phi);

      const nodeData = {
        id: `node_${i}`,
        name: `Node-${String.fromCharCode(65 + (i % 26))}${i}`,
        type: 'node',
        group: group.id,
        description: `${group.name} - Unit #${Math.floor(Math.random() * 9000) + 1000}. Performing routine verification cycles.`,
        x: x,
        y: y,
        z: z,
        vx: 0,
        vy: 0,
        vz: 0,
        isDragged: false,
        isPinned: false,
        connections: 0
      };

      // Create neon glowing glass material
      const nodeMaterial = new THREE.MeshStandardMaterial({
        color: group.color,
        emissive: group.color,
        emissiveIntensity: 0.4,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.9
      });

      const mesh = new THREE.Mesh(this.nodeGeometry, nodeMaterial);
      mesh.position.set(x, y, z);
      mesh.userData = nodeData;
      
      this.graphGroup.add(mesh);
      nodeData.mesh = mesh;
      this.nodes.push(nodeData);
    }

    // 2. Create links (edges)
    // Connect cluster nodes first to create nice hubs
    let attempts = 0;
    while (this.links.length < edgeCount && attempts < 200) {
      attempts++;
      const sourceIdx = Math.floor(Math.random() * nodeCount);
      let targetIdx = Math.floor(Math.random() * nodeCount);
      
      // Prevent self-loops
      if (sourceIdx === targetIdx) continue;
      
      // Prevent duplicate links
      const alreadyExists = this.links.some(l => 
        (l.source.id === this.nodes[sourceIdx].id && l.target.id === this.nodes[targetIdx].id) ||
        (l.source.id === this.nodes[targetIdx].id && l.target.id === this.nodes[sourceIdx].id)
      );
      if (alreadyExists) continue;

      const source = this.nodes[sourceIdx];
      const target = this.nodes[targetIdx];
      
      // Incremet connection counters
      source.connections++;
      target.connections++;

      const linkData = {
        id: `link_${source.id}_${target.id}`,
        type: 'edge',
        source: source,
        target: target,
        description: `Active link between ${source.name} and ${target.name}. Latency: ${Math.floor(Math.random() * 45) + 5}ms. Bandwidth: ${Math.floor(Math.random() * 90) + 10}Gb/s.`
      };

      // Create glowing link cylinder material
      const linkMaterial = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6, // Default purple, will transition between node colors
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
      });

      const mesh = new THREE.Mesh(this.edgeGeometry, linkMaterial);
      mesh.userData = linkData;
      
      this.graphGroup.add(mesh);
      linkData.mesh = mesh;
      this.links.push(linkData);
      
      // Update edge transform
      this.updateEdgeMesh(linkData);
    }
  }

  // Clear existing graph elements
  clearGraph() {
    this.nodes.forEach(n => {
      this.graphGroup.remove(n.mesh);
      n.mesh.geometry.dispose();
      n.mesh.material.dispose();
    });
    this.links.forEach(l => {
      this.graphGroup.remove(l.mesh);
      l.mesh.geometry.dispose();
      l.mesh.material.dispose();
    });
    this.nodes = [];
    this.links = [];
    this.hoveredObject = null;
    this.selectedObject = null;
  }

  // Update a single edge mesh to connect node source and target positions
  updateEdgeMesh(link) {
    const posA = new THREE.Vector3(link.source.x, link.source.y, link.source.z);
    const posB = new THREE.Vector3(link.target.x, link.target.y, link.target.z);
    
    // Calculate direction and length
    const direction = new THREE.Vector3().subVectors(posB, posA);
    const length = direction.length();
    
    // Check for identical positions to avoid Nan values
    if (length < 0.001) return;
    
    // Scale, position, and rotate cylinder
    const mesh = link.mesh;
    mesh.scale.set(1, length, 1);
    
    // Place at midpoint
    const midpoint = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
    mesh.position.copy(midpoint);
    
    // Align default cylinder Y-axis to direction vector
    const alignAxis = new THREE.Vector3(0, 1, 0);
    const directionNormalized = direction.clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(alignAxis, directionNormalized);
    mesh.setRotationFromQuaternion(quaternion);

    // Apply color gradient by blending source and target node colors
    const colorA = new THREE.Color(this.groups[link.source.group].color);
    const colorB = new THREE.Color(this.groups[link.target.group].color);
    mesh.material.color.copy(colorA).lerp(colorB, 0.5);
  }

  // Restores original spherical spacing of nodes
  resetLayout() {
    const nodeCount = this.nodes.length;
    this.nodes.forEach((node, i) => {
      const radius = 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      node.x = this.center.x + radius * Math.sin(phi) * Math.cos(theta);
      node.y = this.center.y + radius * Math.sin(phi) * Math.sin(theta);
      node.z = this.center.z + radius * Math.cos(phi);
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
      node.isPinned = false;
      node.mesh.position.set(node.x, node.y, node.z);
    });

    this.links.forEach(link => {
      this.updateEdgeMesh(link);
    });
  }

  // 3D Force-Directed Simulation Step
  updatePhysics(gravity = 0.05, springStrength = 0.03) {
    const repulsionStrength = 0.06;
    const restLength = 0.8;
    
    // 1. Calculate repulsion forces between all pairs of nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j];
        
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const dz = nodeA.z - nodeB.z;
        const distSq = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(distSq);
        
        // Coulomb repulsion: proportional to 1 / d^2
        const force = repulsionStrength / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        
        // Apply repulsion unless node is manually dragged or pinned
        if (!nodeA.isDragged && !nodeA.isPinned) {
          nodeA.vx += fx;
          nodeA.vy += fy;
          nodeA.vz += fz;
        }
        if (!nodeB.isDragged && !nodeB.isPinned) {
          nodeB.vx -= fx;
          nodeB.vy -= fy;
          nodeB.vz -= fz;
        }
      }
    }
    
    // 2. Calculate attraction forces along edges (Spring Force)
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      const nodeA = link.source;
      const nodeB = link.target;
      
      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const dz = nodeB.z - nodeA.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
      
      // Hooke's Law: F = k * (dist - restLength)
      const force = springStrength * (dist - restLength);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      
      if (!nodeA.isDragged && !nodeA.isPinned) {
        nodeA.vx += fx;
        nodeA.vy += fy;
        nodeA.vz += fz;
      }
      if (!nodeB.isDragged && !nodeB.isPinned) {
        nodeB.vx -= fx;
        nodeB.vy -= fy;
        nodeB.vz -= fz;
      }
    }
    
    // 3. Gravity center pull, friction damping, and position updates
    this.nodes.forEach(node => {
      if (node.isDragged || node.isPinned) {
        // Sync node internal position state to mesh position set by controller/mouse drag
        node.x = node.mesh.position.x;
        node.y = node.mesh.position.y;
        node.z = node.mesh.position.z;
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
      } else {
        // Pull towards VR center Y = 1.5, Z = -1.5
        const gdx = this.center.x - node.x;
        const gdy = this.center.y - node.y;
        const gdz = this.center.z - node.z;
        
        node.vx += gdx * gravity;
        node.vy += gdy * gravity;
        node.vz += gdz * gravity;
        
        // Damping/friction to stop infinite oscillations
        node.vx *= 0.82;
        node.vy *= 0.82;
        node.vz *= 0.82;
        
        // Update positions
        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;
        
        // Apply position to Three.js mesh
        node.mesh.position.set(node.x, node.y, node.z);
      }
    });
    
    // 4. Rebuild edge meshes based on new node coordinates
    this.links.forEach(link => {
      this.updateEdgeMesh(link);
    });
  }

  // Utility to handle selection styling
  selectObject(mesh) {
    // Restore previous selection
    if (this.selectedObject) {
      this.setObjectStyle(this.selectedObject, false, false);
    }

    this.selectedObject = mesh;
    if (mesh) {
      this.setObjectStyle(mesh, true, true);
    }
  }

  // Utility to handle hover styling
  hoverObject(mesh) {
    if (this.hoveredObject === mesh) return;

    // Restore previous hover style if not selected
    if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
      this.setObjectStyle(this.hoveredObject, false, false);
    }

    this.hoveredObject = mesh;
    if (mesh && mesh !== this.selectedObject) {
      this.setObjectStyle(mesh, true, false);
    }
  }

  // Adjust material properties and sizes for selection/hover visual feedback
  setObjectStyle(mesh, highlight, selected) {
    const data = mesh.userData;
    if (!data) return;

    if (data.type === 'node') {
      const material = mesh.material;
      const group = this.groups[data.group];
      
      if (highlight) {
        // Hover or selected node
        material.emissiveIntensity = selected ? 1.0 : 0.7;
        material.opacity = 1.0;
        mesh.scale.setScalar(selected ? 1.3 : 1.15);
      } else {
        // Normal node
        material.emissiveIntensity = 0.4;
        material.opacity = 0.9;
        mesh.scale.setScalar(1.0);
      }
    } else if (data.type === 'edge') {
      const material = mesh.material;
      if (highlight) {
        // Hover or selected link
        material.opacity = selected ? 0.9 : 0.7;
        // Make the glowing edge slightly wider
        mesh.scale.set(selected ? 2.5 : 1.8, mesh.scale.y, selected ? 2.5 : 1.8);
      } else {
        // Normal link
        material.opacity = 0.4;
        mesh.scale.set(1.0, mesh.scale.y, 1.0);
      }
    }
  }
}
