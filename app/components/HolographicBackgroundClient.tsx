'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HolographicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    renderer?: THREE.WebGLRenderer;
    animationId?: number;
  }>({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouseRef = useRef({ x: 0, y: 0 });
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const hoveredShapeRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    console.log('🎨 HolographicBackground: useEffect triggered');
    console.log('🎨 containerRef.current:', containerRef.current);
    
    if (!containerRef.current) {
      console.log('🎨 HolographicBackground: No container ref, exiting');
      return;
    }

    console.log('🎨 HolographicBackground: Starting Three.js scene setup...');

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000511, 0.08);
    console.log('🎨 Scene created');

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 25;
    console.log('🎨 Camera created');

    // Renderer with optimizations
    const renderer = new THREE.WebGLRenderer({ 
      antialias: window.devicePixelRatio < 2, // Only antialias on lower DPI screens
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
    
    // Make the canvas itself clickable and visible
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.pointerEvents = 'auto';
    
    containerRef.current.appendChild(renderer.domElement);
    console.log('🎨 Renderer created and canvas appended to DOM');

    // Holographic blobs (minimal count for cleaner look)
    const blobGeometry = new THREE.IcosahedronGeometry(2, 1);
    const blobs: THREE.Mesh[] = [];

    for (let i = 0; i < 4; i++) { // Reduced to 4 for less clutter
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.5 + Math.random() * 0.3, 1, 0.9), // Brighter
        wireframe: false,
        transparent: true,
        opacity: 0.9, // Much more visible
      });

      const blob = new THREE.Mesh(blobGeometry, material);
      blob.position.set(
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      );
      blob.scale.setScalar(1 + Math.random() * 2.5);
      blobs.push(blob);
      scene.add(blob);
    }
    console.log('🎨 Blobs created:', blobs.length, 'blobs');

    // Small floating blocks - many uniform cubes
    const blockGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5); // Small uniform size
    const blocks: THREE.Mesh[] = [];

    for (let i = 0; i < 25; i++) { // 25 blocks scattered around
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.5 + Math.random() * 0.3, 1, 0.7),
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      });

      const block = new THREE.Mesh(blockGeometry, material);
      block.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
      block.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      block.userData = {
        originalScale: block.scale.clone(),
        originalOpacity: 0.6,
        rotationSpeed: { 
          x: (Math.random() - 0.5) * 0.003, 
          y: (Math.random() - 0.5) * 0.003, 
          z: (Math.random() - 0.5) * 0.003 
        }
      };
      blocks.push(block);
      scene.add(block);
    }
    console.log('🎨 Blocks created:', blocks.length, 'blocks');

    // Small floating rings - multiple torus rings
    const ringGeometry = new THREE.TorusGeometry(3, 0.4, 16, 50);
    const rings: THREE.Mesh[] = [];

    for (let i = 0; i < 8; i++) { // 8 small rings
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.5 + i * 0.1, 1, 0.7),
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });

      const ring = new THREE.Mesh(ringGeometry, material);
      ring.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50
      );
      ring.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      ring.userData = {
        originalScale: 1,
        originalOpacity: 0.7,
        rotationSpeed: { 
          x: (Math.random() - 0.5) * 0.002, 
          y: (Math.random() - 0.5) * 0.002, 
          z: (Math.random() - 0.5) * 0.002 
        }
      };
      rings.push(ring);
      scene.add(ring);
    }
    console.log('🎨 Rings created:', rings.length, 'rings');

    // Interactive wireframe shapes - minimal
    const shapeGeometries = [
      new THREE.OctahedronGeometry(2),
    ]; // Just 1 small shape

    const interactiveShapes: THREE.Mesh[] = [];

    for (let i = 0; i < shapeGeometries.length; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.5 + i * 0.1, 1, 0.7),
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });

      const shape = new THREE.Mesh(shapeGeometries[i], material);
      shape.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      );
      shape.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      shape.scale.setScalar(0.5);
      shape.userData = {
        originalScale: shape.scale.clone(),
        originalOpacity: 0.5,
        rotationSpeed: { x: (Math.random() - 0.5) * 0.001, y: (Math.random() - 0.5) * 0.001, z: (Math.random() - 0.5) * 0.001 }
      };
      interactiveShapes.push(shape);
      scene.add(shape);
    }
    console.log('🎨 Interactive shapes created:', interactiveShapes.length, 'shapes');

    // Particle system (minimal for cleaner look)
    const particleCount = 500; // Reduced from 1000 for less clutter
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 100;
      particlePositions[i + 1] = (Math.random() - 0.5) * 100;
      particlePositions[i + 2] = (Math.random() - 0.5) * 100;
    }

    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8, // Bigger and more visible
      transparent: true,
      opacity: 1, // Full brightness
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    console.log('🎨 Particles created:', particleCount, 'particles');

    // Volumetric light rays (closer ones) - highly visible
    const lightGeometry = new THREE.ConeGeometry(3, 60, 32);
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5, // Much brighter
      side: THREE.DoubleSide,
    });

    const lightRays: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) { // Reduced from 8 to 4 light rays
      const ray = new THREE.Mesh(lightGeometry, lightMaterial);
      ray.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        -20
      );
      ray.rotation.x = Math.PI / 2;
      ray.rotation.z = Math.random() * Math.PI * 2;
      lightRays.push(ray);
      scene.add(ray);
    }
    console.log('🎨 Light rays created:', lightRays.length, 'rays');

    // Distant light shafts (from far away, like sunbeams through clouds) - visible
    const distantShaftGeometry = new THREE.ConeGeometry(8, 150, 32);
    const distantShaftMaterial = new THREE.MeshBasicMaterial({
      color: 0x4facfe,
      transparent: true,
      opacity: 0.3, // Much more visible
      side: THREE.DoubleSide,
    });

    const distantShafts: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) { // Reduced from 5 to 3 distant shafts
      const shaft = new THREE.Mesh(distantShaftGeometry, distantShaftMaterial);
      shaft.position.set(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        -80 - Math.random() * 40
      );
      shaft.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      shaft.rotation.z = Math.random() * Math.PI * 2;
      distantShafts.push(shaft);
      scene.add(shaft);
    }
    console.log('🎨 Distant light shafts created:', distantShafts.length, 'shafts');

    // 3D Floating Text "444 Radio" - Small white floating text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;
    
    // Draw text on canvas
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 48px Arial';
    context.fillStyle = 'rgba(255, 255, 255, 1)'; // Fully white text
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('444 RADIO', canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const textTexture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
      opacity: 0.7, // Much more visible
      side: THREE.DoubleSide,
    });
    
    // Create multiple small floating text instances (4 instances for cleaner look)
    const textGeometry = new THREE.PlaneGeometry(15, 3.75); // Small size
    const textMeshes: THREE.Mesh[] = [];
    
    for (let i = 0; i < 4; i++) { // Reduced from 8 to 4 text instances
      const textMesh = new THREE.Mesh(textGeometry, textMaterial.clone());
      textMesh.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 60 - 30
      );
      textMesh.rotation.y = Math.random() * Math.PI * 2;
      textMesh.userData = {
        basePosition: textMesh.position.clone(),
        speed: 0.0001 + Math.random() * 0.0002,
        offset: Math.random() * Math.PI * 2
      };
      textMeshes.push(textMesh);
      scene.add(textMesh);
    }
    
    console.log('🎨 3D Text created: 8 small white "444 RADIO" instances');

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x222244, 1);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x00d4ff, 2, 100);
    pointLight1.position.set(20, 20, 20);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff00ff, 2, 100);
    pointLight2.position.set(-20, -20, -20);
    scene.add(pointLight2);

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    raycasterRef.current = raycaster;
    const mouse = new THREE.Vector2();

    // Mouse move handler
    const handleMouseMove = (event: MouseEvent) => {
      targetMouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetMouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      mouse.x = targetMouseRef.current.x;
      mouse.y = targetMouseRef.current.y;
      
      raycaster.setFromCamera(mouse, camera);
      // Check all interactive objects: rings, blocks, and shapes
      const allInteractiveObjects = [...rings, ...blocks, ...interactiveShapes];
      const intersects = raycaster.intersectObjects(allInteractiveObjects);
      
      // Reset previous hovered shape
      if (hoveredShapeRef.current && !intersects.find(i => i.object === hoveredShapeRef.current)) {
        const mat = (hoveredShapeRef.current.material as THREE.MeshBasicMaterial);
        mat.opacity = hoveredShapeRef.current.userData.originalOpacity;
        hoveredShapeRef.current.scale.copy(hoveredShapeRef.current.userData.originalScale);
        hoveredShapeRef.current = null;
      }
      
      // Highlight hovered shape
      if (intersects.length > 0) {
        const shape = intersects[0].object as THREE.Mesh;
        if (shape !== hoveredShapeRef.current) {
          hoveredShapeRef.current = shape;
          const mat = (shape.material as THREE.MeshBasicMaterial);
          mat.opacity = 0.95;
          shape.scale.multiplyScalar(1.2);
        }
      }
    };

    // Mouse click handler - spin the shape
    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      // Check all interactive objects
      const allInteractiveObjects = [...rings, ...blocks, ...interactiveShapes];
      const intersects = raycaster.intersectObjects(allInteractiveObjects);
      
      if (intersects.length > 0) {
        const shape = intersects[0].object as THREE.Mesh;
        console.log('🎯 Object clicked!', shape.geometry.type);
        
        // Add spinning animation
        shape.userData.rotationSpeed.x += (Math.random() - 0.5) * 0.03;
        shape.userData.rotationSpeed.y += (Math.random() - 0.5) * 0.03;
        shape.userData.rotationSpeed.z += (Math.random() - 0.5) * 0.03;
        
        // Change color
        const mat = (shape.material as THREE.MeshBasicMaterial);
        mat.color.setHSL(Math.random(), 1, 0.7);
        
        // Pulse scale
        shape.scale.multiplyScalar(1.5);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    // Track scroll position for parallax
    let scrollY = 0;
    const handleScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Animation loop
    let time = 0;
    const loopDuration = 20; // 20 seconds for complete loop
    const initialCameraZ = 25;

    const animate = () => {
      time += 0.01;
      const loopTime = (time % loopDuration) / loopDuration; // 0 to 1

      // Camera dolly - smooth loop using sine wave + scroll parallax
      const dollyDistance = Math.sin(loopTime * Math.PI * 2) * 5;
      const scrollParallax = scrollY * 0.01; // Subtle scroll effect
      camera.position.z = initialCameraZ + dollyDistance + scrollParallax;

      // Animate blobs with cursor interaction
      blobs.forEach((blob, i) => {
        blob.rotation.x += 0.001 * (i + 1);
        blob.rotation.y += 0.002 * (i + 1);
        
        // Gentle floating motion
        const speed = 0.0005 * (i + 1);
        blob.position.y += Math.sin(time * speed) * 0.02;
        blob.position.x += Math.cos(time * speed * 0.7) * 0.02;

        // Cursor interaction - scale and glow on hover
        const distX = mouseRef.current.x * 30 - blob.position.x;
        const distY = mouseRef.current.y * 30 - blob.position.y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        if (distance < 25) {
          // Scale up when cursor is near
          const scaleFactor = 1 + (25 - distance) / 50;
          blob.scale.setScalar(scaleFactor);
          // Increase opacity
          (blob.material as THREE.MeshBasicMaterial).opacity = 1.0;
        } else {
          // Return to normal
          blob.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
          (blob.material as THREE.MeshBasicMaterial).opacity = 0.9;
        }

        // Iridescent color shift
        const hue = (0.5 + Math.sin(time * 0.1 + i) * 0.15) % 1;
        (blob.material as THREE.MeshBasicMaterial).color.setHSL(hue, 0.8, 0.9);
      });

      // Animate 3D text - small white floating text with cursor interaction
      textMeshes.forEach((textMesh, i) => {
        // Gentle floating
        const floatSpeed = textMesh.userData.speed;
        const offset = textMesh.userData.offset;
        textMesh.position.y = textMesh.userData.basePosition.y + Math.sin(time * floatSpeed + offset) * 3;
        textMesh.position.x = textMesh.userData.basePosition.x + Math.cos(time * floatSpeed * 0.7 + offset) * 2;
        
        // Rotate slowly
        textMesh.rotation.y += 0.001;
        
        // React to mouse position
        const distX = mouseRef.current.x * 20 - textMesh.position.x;
        const distY = mouseRef.current.y * 20 - textMesh.position.y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        if (distance < 30) {
          // Move away from cursor
          textMesh.position.x -= distX * 0.01;
          textMesh.position.y -= distY * 0.01;
        }
        
        // Fade based on distance from camera
        const distFromCamera = Math.abs(textMesh.position.z - camera.position.z);
        (textMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.5, Math.min(0.9, 50 / distFromCamera));
      });

      // Animate floating blocks - smooth rotation and gentle drift
      blocks.forEach((block, i) => {
        // Apply custom rotation speeds
        block.rotation.x += block.userData.rotationSpeed.x;
        block.rotation.y += block.userData.rotationSpeed.y;
        block.rotation.z += block.userData.rotationSpeed.z;

        // Gentle floating motion
        block.position.y += Math.sin(time * 0.0004 + i) * 0.02;
        block.position.x += Math.cos(time * 0.0003 + i) * 0.015;

        // Subtle cursor interaction - slight attraction
        const distX = mouseRef.current.x * 30 - block.position.x;
        const distY = mouseRef.current.y * 30 - block.position.y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        if (distance < 30) {
          const attractStrength = (30 - distance) / 30;
          block.position.x += distX * 0.003 * attractStrength;
          block.position.y += distY * 0.003 * attractStrength;
          // Increase opacity when near cursor
          (block.material as THREE.MeshBasicMaterial).opacity = 0.6 + attractStrength * 0.3;
        } else {
          (block.material as THREE.MeshBasicMaterial).opacity = 0.6;
        }

        // Color cycle
        const hue = (0.5 + i * 0.04 + time * 0.02) % 1;
        (block.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.7);
      });

      // Animate floating rings - smooth rotation and cursor interaction
      rings.forEach((ring, i) => {
        // Apply custom rotation speeds
        ring.rotation.x += ring.userData.rotationSpeed.x;
        ring.rotation.y += ring.userData.rotationSpeed.y;
        ring.rotation.z += ring.userData.rotationSpeed.z;

        // Gentle floating motion
        ring.position.y += Math.sin(time * 0.0005 + i) * 0.025;
        ring.position.x += Math.cos(time * 0.0004 + i) * 0.02;

        // Cursor interaction - scale and glow
        const distX = mouseRef.current.x * 30 - ring.position.x;
        const distY = mouseRef.current.y * 30 - ring.position.y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        if (distance < 35) {
          const attractStrength = (35 - distance) / 35;
          // Scale up when near cursor
          ring.scale.setScalar(1 + attractStrength * 0.3);
          // Increase opacity
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.7 + attractStrength * 0.3;
          // Attract toward cursor
          ring.position.x += distX * 0.004 * attractStrength;
          ring.position.y += distY * 0.004 * attractStrength;
        } else {
          // Return to normal
          ring.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.7;
        }

        // Color cycle
        const hue = (0.5 + i * 0.12 + time * 0.025) % 1;
        (ring.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.7);
      });

      // Animate interactive wireframe shapes with cursor attraction
      interactiveShapes.forEach((shape, i) => {
        // Apply custom rotation speeds
        shape.rotation.x += shape.userData.rotationSpeed.x;
        shape.rotation.y += shape.userData.rotationSpeed.y;
        shape.rotation.z += shape.userData.rotationSpeed.z;

        // Gentle floating
        shape.position.y += Math.sin(time * 0.0003 + i) * 0.03;
        shape.position.x += Math.cos(time * 0.0002 + i) * 0.02;

        // Cursor interaction - attract shapes slightly toward cursor
        const distX = mouseRef.current.x * 25 - shape.position.x;
        const distY = mouseRef.current.y * 25 - shape.position.y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        if (distance < 35) {
          const attractStrength = (35 - distance) / 35;
          shape.position.x += distX * 0.005 * attractStrength;
          shape.position.y += distY * 0.005 * attractStrength;
          // Spin faster when cursor is near
          shape.rotation.x += attractStrength * 0.01;
          shape.rotation.y += attractStrength * 0.01;
        }

        // Color cycle
        const hue = (0.5 + i * 0.08 + time * 0.03) % 1;
        (shape.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.6);
      });

      // Camera parallax movement based on mouse
      camera.position.x = mouseRef.current.x * 3;
      camera.position.y = mouseRef.current.y * 3;
      camera.lookAt(0, 0, 0);

      // Animate particles - slow drift with cursor avoidance
      const positions = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time * 0.001 + positions[i]) * 0.02;
        
        // Cursor interaction - particles move away
        const distX = mouseRef.current.x * 50 - positions[i];
        const distY = mouseRef.current.y * 50 - positions[i + 1];
        const dist = Math.sqrt(distX * distX + distY * distY);
        
        if (dist < 20) {
          const pushStrength = (20 - dist) / 20;
          positions[i] -= distX * 0.002 * pushStrength;
          positions[i + 1] -= distY * 0.002 * pushStrength;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particles.rotation.y += 0.0001;

      // Animate light rays with cursor glow
      lightRays.forEach((ray, i) => {
        ray.rotation.z += 0.0005 * (i + 1);
        
        // Cursor interaction - increase glow intensity when cursor is near
        const distX = mouseRef.current.x * 30 - ray.position.x;
        const distY = mouseRef.current.y * 30 - ray.position.y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        if (distance < 30) {
          const glowBoost = (30 - distance) / 30;
          (ray.material as THREE.MeshBasicMaterial).opacity = 0.3 + glowBoost * 0.4;
          // Slight rotation response
          ray.rotation.z += glowBoost * 0.002;
        } else {
          (ray.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(time * 0.1 + i) * 0.1;
        }
      });

      // Animate distant light shafts with subtle cursor response
      distantShafts.forEach((shaft, i) => {
        shaft.rotation.z += 0.0002 * (i + 1);
        
        // Subtle glow increase when cursor moves
        const mouseMovement = Math.abs(mouseRef.current.x) + Math.abs(mouseRef.current.y);
        const baseOpacity = 0.1 + Math.sin(time * 0.05 + i) * 0.05;
        (shaft.material as THREE.MeshBasicMaterial).opacity = baseOpacity + mouseMovement * 0.05;
      });

      renderer.render(scene, camera);
      sceneRef.current.animationId = requestAnimationFrame(animate);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Store refs
    sceneRef.current = { scene, camera, renderer };

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      
      // Dispose geometries and materials
      blobs.forEach(blob => {
        blob.geometry.dispose();
        (blob.material as THREE.Material).dispose();
      });
      interactiveShapes.forEach(shape => {
        shape.geometry.dispose();
        (shape.material as THREE.Material).dispose();
      });
      particleGeometry.dispose();
      particleMaterial.dispose();
      lightRays.forEach(ray => {
        ray.geometry.dispose();
        (ray.material as THREE.Material).dispose();
      });
      distantShafts.forEach(shaft => {
        shaft.geometry.dispose();
        (shaft.material as THREE.Material).dispose();
      });
      
      // Dispose text meshes
      textMeshes.forEach(mesh => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      textTexture.dispose();
      
      // Remove event listeners
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
      
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0"
      style={{
        zIndex: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, #000511 0%, #000000 100%)',
      }}
    />
  );
}
