# Sentinal3D // Lawful Intercept Link Chart Viewer

Sentinal3D is an immersive, enterprise-grade 3D and Virtual Reality (VR) link-analysis charting web application tailored for lawful interception (LI), signal intelligence, and communications network tracing. Built with Three.js and Vite, it visualizes complex nodes (such as communication devices, servers, or target identities) and links (data packets, phone calls, signal channels) in an interactive, physics-driven 3D space.

Designed with a clean, dark slate enterprise layout, Sentinal3D is fully optimized for both desktop browsers and immersive WebXR headsets (such as the Meta Quest 2).

---

## 🚀 Key Features

* **3D Force-Directed Simulation**: Dynamically arranges nodes using configurable spring-attraction, node-repulsion, and center-gravity physics, allowing natural cluster formation.
* **Tractor Beam VR Zooming**: Point the laser pointer at a node or cluster and push the joystick forward/backward to translate the scene along the laser's ray. Pull targets directly to your hand or push them away.
* **Center-Orbit VR Rotation**: Rotate the entire graph around its visual center `(0, 1.5, -1.5)` using the joystick X-axis, preventing disorienting sweeping rotations.
* **Responsive Grab-Space Panning**: Pull and hold the controller trigger on empty space to grab and drag the entire 3D network workspace. Hand movement is amplified by 4.5x for highly responsive panning.
* **Physical Node Pinning**: Dragging and releasing a node (via mouse or Quest controller trigger) automatically anchors it in place (`isPinned = true`). Pinned nodes act as rigid anchors and are unaffected by physics forces.
* **Canvas-Projected Details Card**: A billboarded 3D details card drawn via a 2D canvas texture that floats above selected items, rotates to face the user, and supports interactive in-VR actions (such as unpinning nodes).
* **Secure WebXR over LAN**: Integrated SSL capabilities allow hosting Vite securely over HTTPS to support direct, wireless WebXR launching on Meta Quest devices.

---

## 🏗️ Technical Architecture

The application is structured as a modular, vanilla JavaScript bundle:

* **[index.html](file:///d:/Users/Josh/Documents/Homelab/AR-Viewer/index.html)**: The desktop viewport and sidebar inspector panel dashboard.
* **[src/main.js](file:///d:/Users/Josh/Documents/Homelab/AR-Viewer/src/main.js)**: Initializes the WebGL renderer, camera, lights, OrbitControls, and drives the WebXR animation loop.
* **[src/GraphEngine.js](file:///d:/Users/Josh/Documents/Homelab/AR-Viewer/src/GraphEngine.js)**: Orchestrates the graph data structure, 3D meshes (glass-like spheres for nodes and cylinders for links), and solves the physical force vectors.
* **[src/VRInterface.js](file:///d:/Users/Josh/Documents/Homelab/AR-Viewer/src/VRInterface.js)**: Draws the floating 3D control panel and details card by writing directly to projected canvas textures. Handles UI raycasting.
* **[src/InteractionHandler.js](file:///d:/Users/Josh/Documents/Homelab/AR-Viewer/src/InteractionHandler.js)**: Manages desktop mouse raycasting, virtual drag planes, Quest controller inputs, and implements the space panning/joystick navigation.
* **[src/style.css](file:///d:/Users/Josh/Documents/Homelab/AR-Viewer/src/style.css)**: The dark slate, minimalist CSS theme.

---

## 💻 Getting Started

### Prerequisites

* Node.js (version 18 or higher recommended)
* npm (Node Package Manager)

### Installation

1. Navigate to the project directory:
   ```bash
   cd d:\Users\Josh\Documents\Homelab\AR-Viewer
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```

### Running Locally on Desktop

Run the Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🥽 Running wirelessly on Meta Quest 2

WebXR requires a secure origin (`https://`). Vite is configured with a self-signed certificate plugin to allow wireless LAN testing:

1. Start the secure server:
   ```bash
   npm run dev
   ```
2. Note the network address printed in your terminal (e.g., `https://192.168.2.32:5173/`).
3. Open the **Meta Quest Browser** in your headset and enter the HTTPS network URL.
4. Click **Advanced** and then **Proceed** to bypass the self-signed certificate warning.
5. Click **ENTER VR** at the bottom of the screen to launch the immersive interface.

---

## 🎮 Controls Guide

### Desktop Mouse Controls
* **Orbit Camera**: Left-click and drag on empty space to rotate. Right-click and drag to pan. Scroll to zoom.
* **Drag Nodes**: Click and hold a node to reposition it. Connecting links will stretch. Releasing a node pins it.
* **Select**: Click a node or edge to open the 3D Details Card and populate the desktop sidebar inspector.
* **Unpin Node**: Click the **Unpin Node** button in the sidebar inspector to release a pinned node.
* **Search**: Type a node name in the search bar and press Enter (or click an item) to focus the camera.

### VR Controller Bindings
* **Laser Ray Pointer**: Projects from each controller with a cursor ring indicating interactive targets.
* **Grab-Space Panning**: Pull and hold the **Trigger** on empty space and move your hand to pan the graph.
* **Tractor Beam Zoom**: Push the **Joystick Y-axis** forward/up to pull the targeted area closer (zoom in), or pull it backward/down to push it away (zoom out).
* **Center Orbit Rotation**: Push the **Joystick X-axis** left/right to rotate the graph around its center point.
* **Reposition Nodes**: Point at a node, pull and hold the **Trigger**, and move your controller. Releasing pins it.
* **Unpin Nodes**: Point your laser pointer at the red **UNPIN** button on the node's 3D card and pull the trigger.
* **VR Control Desk**: Point and click on the floating control buttons:
  * **Reset Layout**: Re-centers all nodes and clears all active pins.
  * **Regenerate Graph**: Generates a new random link network.
  * **Physics (ON/OFF)**: Toggles the spring-physics simulation.
