'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Image as DreiImage, Html } from '@react-three/drei'
import * as THREE from 'three'

interface MediaItem {
  id: string
  type: 'image' | 'video' | 'audio'
  url: string
  thumbnailUrl?: string
  title?: string
  position?: [number, number, number]
}

interface FloatingMediaProps {
  item: MediaItem
  position: [number, number, number]
  onClick?: () => void
}

function FloatingMediaCard({ item, position, onClick }: FloatingMediaProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.2
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
      meshRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.2) * 0.05
    }
  })

  const getIconEmoji = () => {
    switch (item.type) {
      case 'image': return '🎨'
      case 'video': return '🎬'
      case 'audio': return '🎵'
      default: return '📄'
    }
  }

  const getColorByType = () => {
    switch (item.type) {
      case 'image': return '#06b6d4' // cyan
      case 'video': return '#a855f7' // purple
      case 'audio': return '#10b981' // green
      default: return '#6b7280'
    }
  }

  return (
    <group ref={groupRef} position={position}>
      <mesh 
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        {/* Card background */}
        <boxGeometry args={[2, 2.5, 0.1]} />
        <meshStandardMaterial 
          color={getColorByType()} 
          metalness={0.8} 
          roughness={0.2}
          emissive={getColorByType()}
          emissiveIntensity={0.2}
        />
        
        {/* Image texture for images */}
        {item.type === 'image' && item.url && (
          <DreiImage 
            url={item.url} 
            position={[0, 0, 0.06]}
            scale={[1.8, 1.8]}
            transparent
            opacity={0.95}
          />
        )}

        {/* Video preview plane */}
        {item.type === 'video' && item.thumbnailUrl && (
          <DreiImage 
            url={item.thumbnailUrl} 
            position={[0, 0, 0.06]}
            scale={[1.8, 1.8]}
            transparent
            opacity={0.9}
          />
        )}

        {/* Icon label */}
        <Html
          position={[0, -1, 0.06]}
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            fontSize: '3rem',
          }}
        >
          {getIconEmoji()}
        </Html>

        {/* Glow effect */}
        <pointLight 
          position={[0, 0, 1]} 
          color={getColorByType()} 
          intensity={0.5} 
          distance={3}
        />
      </mesh>
    </group>
  )
}

interface FloatingMediaPreviewProps {
  mediaItems: MediaItem[]
  onMediaClick?: (item: MediaItem) => void
}

export default function FloatingMediaPreview({ mediaItems, onMediaClick }: FloatingMediaPreviewProps) {
  // Generate spiral positions for media items
  const positions = useMemo(() => {
    const radius = 5
    const heightSpacing = 2
    return mediaItems.map((_, index) => {
      const angle = (index * Math.PI * 2) / Math.max(mediaItems.length, 6)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = (index % 3) * heightSpacing - heightSpacing
      return [x, y, z] as [number, number, number]
    })
  }, [mediaItems])

  return (
    <div className="w-full h-full">
      <Canvas 
        camera={{ position: [0, 2, 8], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00ffff" />
        <spotLight 
          position={[0, 10, 0]} 
          angle={0.5} 
          penumbra={1} 
          intensity={1}
          color="#10b981"
        />

        {/* Floating media cards */}
        {mediaItems.map((item, index) => (
          <FloatingMediaCard
            key={item.id}
            item={item}
            position={positions[index]}
            onClick={() => onMediaClick?.(item)}
          />
        ))}

        {/* Background particles */}
        <FloatingParticles />
      </Canvas>
    </div>
  )
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  
  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02
      particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1
    }
  })

  const particleCount = 200
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return pos
  }, [])

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geom
  }, [positions])

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial 
        size={0.05} 
        color="#00ffff" 
        transparent 
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

