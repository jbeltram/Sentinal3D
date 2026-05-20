# Sentinal3D // Security Analysis & Threat Model

This document provides a comprehensive security review of the Sentinal3D 3D Link Chart Viewer. It covers third-party dependency vulnerability scans, custom code static analysis, client-side data exposure boundaries, and guidance for secure deployment inside corporate networks.

---

## 1. Executive Summary

Sentinal3D is a client-side Single Page Application (SPA) utilizing Three.js for WebGL rendering and WebXR device integration. It has no custom server-side execution runtime or database storage of its own (it is bundled as a static frontend asset). 

**Vulnerability Assessment Summary:**
* **Third-Party Dependencies**: **0 Vulnerabilities Found** (via `npm audit`).
* **Cross-Site Scripting (XSS)**: **Secure**. All user inputs are handled using native DOM building APIs with `textContent` encoding.
* **Network Context**: **Secure**. WebXR bindings are restricted by the user agent to secure origins (`https` or `localhost`), mitigating session hijacking threats during immersive usage.

---

## 2. Third-Party Dependency Audit

A security scan of the active Node/npm package manifest was performed using `npm audit`.

```text
$ npm audit
found 0 vulnerabilities
```

### Dependency Inventory

| Package | Purpose | Risk Classification | Analysis & Justification |
| :--- | :--- | :--- | :--- |
| `three` | WebGL 3D Graph and Camera rendering engine | Low | High-frequency update cycle. Renders inside isolated canvas. No direct DOM access or network fetching capability. |
| `vite` | Next-generation bundler and local dev server | Low (Dev only) | Standard build-tooling. Run locally in sandboxed environments. Not exposed to production containers. |
| `@vitejs/plugin-basic-ssl` | Generates self-signed certificates for local HTTPS | Medium (Dev only) | Employs a self-signed key for dev cycles. *Must not be utilized in production* (see Section 4). |

---

## 3. Application Code Security Audit (Static Analysis)

A manual code audit was conducted across all files in the `src/` directory to identify logical vulnerabilities, input injections, or state manipulation bugs.

### Cross-Site Scripting (XSS) & DOM Injection
XSS is the primary threat to client-side graph visualizers when ingesting arbitrary network strings (e.g. Node Names, IP addresses, Descriptions). 

* **Finding**: `innerHTML` is only used once in the codebase inside [src/InteractionHandler.js](file:///d:/Users/Josh/Documents/Homelab/AR-Viewer/src/InteractionHandler.js#L587) to clear search nodes:
  ```javascript
  this.searchResultsEl.innerHTML = '';
  ```
  This usage is entirely safe as no user string is compiled.
* **Finding**: Dynamic search items are appended safely via programmatically created DOM elements using `.textContent`:
  ```javascript
  const item = document.createElement('div');
  item.textContent = `${node.name} (${this.graphEngine.groups[node.group].name})`;
  ```
  `.textContent` forces the browser to treat the input string as raw text rather than executable HTML, sanitizing against potential payload injections.
* **Finding**: VR details cards draw texts onto the 2D canvas backing using `ctx.fillText()`. This operates outside the DOM tree and cannot compile script tags, neutralizing HTML injection vectors inside the 3D space.

### WebXR Raycast Manipulation (Clickjacking)
Because button presses on the floating 3D control panel and details card are driven by mathematical raycast intersections mapping UV coordinates to pixel boundaries:
* Standard DOM clickjacking techniques (overlaying transparent `<iframe>` layers) are ineffective. 
* There is no underlying HTML DOM structure for the 3D canvas panels. Malicious browser scripts cannot trigger button events via standard DOM click dispatchers.

### Data Protection (In-Memory Payload)
* **Threat**: All graph details (nodes, edges, descriptions) are loaded into the browser's JavaScript memory space (`this.nodes` / `this.links` in `GraphEngine.js`).
* **Risk**: If a user runs malicious browser extensions, or the application is compromised by an external script, the graph state can be scraped directly from memory.
* **Mitigation**: Ensure that standard Content Security Policies (CSP) are active on the hosting domain to prevent unauthorized scripts from executing or exfiltrating data via unauthorized `fetch`/`XHR` connections.

---

## 4. Network & WebXR Communication Security

Immersive WebXR applications have unique network constraints mandated by browsers (specifically Chromium and the Oculus Browser).

### Secure Contexts (WebXR Requirement)
The WebXR Device API is exclusively exposed to **Secure Contexts**. If the app is served over standard `http://` across a LAN, the browser blocks headset sensor access and the "ENTER VR" button is disabled.

```
                  ┌──────────────────────────────┐
                  │   User in Oculus Browser     │
                  └──────────────┬───────────────┘
                                 │ Accesses https://<IP>:5173
                                 ▼
                  ┌──────────────────────────────┐
                  │   Browser Security Context   │
                  └──────────────┬───────────────┘
                                 ├─► Is HTTPS / Localhost? ──► YES: Enable WebXR (Immersive VR)
                                 └─► Is HTTP (LAN)? ─────────► NO:  Block WebXR (Desktop Only)
```

### Risks of Self-Signed Certificates in Dev
Sentinal3D uses `@vitejs/plugin-basic-ssl` to generate a self-signed SSL certificate for local LAN development:
* **The Risk**: Browsers throw a "Connection Not Private" warning because the certificate is not issued by a trusted Root Certificate Authority (CA). Bypassing this warning exposes the traffic to potential Man-in-the-Middle (MitM) sniffing on the local Wi-Fi router.
* **Development Verdict**: Acceptable for testing dummy graph geometries, but **do not input real or classified intelligence data while testing over a self-signed connection**.
* **Production Recommendation**: Replace the self-signed developer configuration in Vite with a certificate issued by your enterprise CA or Let's Encrypt, and enforce TLS 1.3.

---

## 5. Security Checklist for Enterprise Deployment

When integrating Sentinal3D with proprietary backends or databases at work, enforce the following architecture controls:

1. **API Authentication**: Secure all REST/WebSocket endpoints that supply data to the link chart using standard authentication headers (JWT, OAuth2).
2. **CORS Configuration**: Restrict the backend server's `Access-Control-Allow-Origin` headers specifically to the domain hosting Sentinal3D. Avoid using wildcard `*` headers.
3. **Content Security Policy (CSP)**: Configure the hosting web server (Nginx, IIS, Apache) to return a strict CSP header:
   ```text
   Content-Security-Policy: default-src 'self'; connect-src 'self' https://your-backend-api.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
   ```
4. **Data Sanitization**: If node labels or descriptions are retrieved from a database containing user-submitted text, ensure they are thoroughly sanitized on the backend prior to JSON serialization.
