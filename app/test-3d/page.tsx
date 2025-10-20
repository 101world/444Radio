'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';

// Import Three.js dynamically
const Test3DClient = dynamic(
  () => Promise.resolve(Test3DComponent),
  { ssr: false }
);

function Test3DComponent() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Dynamically import THREE
    import('three').then((THREE) => {
      console.log('THREE.js version:', THREE.REVISION);
      console.log('Container:', containerRef.current);

      // Simple Three.js test
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      
      renderer.setSize(window.innerWidth, window.innerHeight);
      containerRef.current!.appendChild(renderer.domElement);

      // Create a simple cube
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      camera.position.z = 5;

      // Animation loop
      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
      };

      animate();

      // Cleanup
      return () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (containerRef.current && renderer.domElement && containerRef.current.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default function Test3D() {
  return (
    <div className="min-h-screen bg-black text-white relative">
      <h1 className="absolute top-10 left-10 z-50 text-4xl font-bold text-green-400 drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
        Three.js Test - You should see a rotating green wireframe cube
      </h1>
      <Test3DClient />
    </div>
  );
}
