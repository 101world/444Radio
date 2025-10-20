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

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000511, 0.08);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 25;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Holographic blobs
    const blobGeometry = new THREE.IcosahedronGeometry(1, 1);
    const blobs: THREE.Mesh[] = [];

    for (let i = 0; i < 8; i++) {
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.8, 0.5),
        metalness: 0.9,
        roughness: 0.1,
        transmission: 0.5,
        thickness: 0.5,
        envMapIntensity: 1,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
      });

      const blob = new THREE.Mesh(blobGeometry, material);
      blob.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      );
      blob.scale.setScalar(1 + Math.random() * 2);
      blobs.push(blob);
      scene.add(blob);
    }

    // Wireframe torus rings
    const torusGeometry = new THREE.TorusGeometry(5, 0.5, 16, 100);
    const tori: THREE.Mesh[] = [];

    for (let i = 0; i < 5; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.5 + i * 0.1, 1, 0.5),
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      });

      const torus = new THREE.Mesh(torusGeometry, material);
      torus.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      );
      torus.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      tori.push(torus);
      scene.add(torus);
    }

    // Particle system
    const particleCount = 2000;
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
      color: 0x4facfe,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Volumetric light rays
    const lightGeometry = new THREE.ConeGeometry(0.5, 50, 32);
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
    });

    const lightRays: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ray = new THREE.Mesh(lightGeometry, lightMaterial);
      ray.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        -40
      );
      ray.rotation.x = Math.PI / 2;
      lightRays.push(ray);
      scene.add(ray);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x222244, 1);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x00d4ff, 2, 100);
    pointLight1.position.set(20, 20, 20);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff00ff, 2, 100);
    pointLight2.position.set(-20, -20, -20);
    scene.add(pointLight2);

    // Animation loop
    let time = 0;
    const loopDuration = 20; // 20 seconds for complete loop
    const initialCameraZ = 25;

    const animate = () => {
      time += 0.01;
      const loopTime = (time % loopDuration) / loopDuration; // 0 to 1

      // Camera dolly - smooth loop using sine wave
      const dollyDistance = Math.sin(loopTime * Math.PI * 2) * 5;
      camera.position.z = initialCameraZ + dollyDistance;

      // Animate blobs
      blobs.forEach((blob, i) => {
        blob.rotation.x += 0.001 * (i + 1);
        blob.rotation.y += 0.002 * (i + 1);
        
        // Gentle floating motion
        const speed = 0.0005 * (i + 1);
        blob.position.y += Math.sin(time * speed) * 0.02;
        blob.position.x += Math.cos(time * speed * 0.7) * 0.02;

        // Iridescent color shift
        const hue = (0.5 + Math.sin(time * 0.1 + i) * 0.15) % 1;
        (blob.material as THREE.MeshPhysicalMaterial).color.setHSL(hue, 0.8, 0.5);
      });

      // Animate torus rings
      tori.forEach((torus, i) => {
        torus.rotation.x += 0.001 * (i % 2 === 0 ? 1 : -1);
        torus.rotation.y += 0.002 * (i % 2 === 0 ? -1 : 1);
        torus.rotation.z += 0.0015;

        // Color cycle
        const hue = (0.5 + i * 0.1 + time * 0.05) % 1;
        (torus.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.5);
      });

      // Animate particles - slow drift
      const positions = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time * 0.001 + positions[i]) * 0.02;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particles.rotation.y += 0.0001;

      // Animate light rays
      lightRays.forEach((ray, i) => {
        ray.rotation.z += 0.0005 * (i + 1);
        (ray.material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(time * 0.1 + i) * 0.02;
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
      tori.forEach(torus => {
        torus.geometry.dispose();
        (torus.material as THREE.Material).dispose();
      });
      particleGeometry.dispose();
      particleMaterial.dispose();
      lightRays.forEach(ray => {
        ray.geometry.dispose();
        (ray.material as THREE.Material).dispose();
      });
      
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10"
      style={{
        background: 'radial-gradient(ellipse at center, #000511 0%, #000000 100%)',
      }}
    />
  );
}
