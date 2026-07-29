import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { E2E } from '@/lib/e2e'
import { cn } from '@/lib/cn'
import earthBlueprint from '@/assets/earth-blueprint.png'

/* Same hexes the vessel scene draws in, so the two 3D pieces share a palette.
   navy for structure, cyan for linework, amber reserved for the one hub. */
const COLOR = {
  navy900: '#0a1c2d',
  signal500: '#00b4d5',
  signal400: '#39c8e0',
  signal300: '#7ae4f3',
  alert500: '#f49329',
} as const

const DEG = Math.PI / 180

/**
 * A latitude/longitude pair to a point on a sphere of the given radius.
 *
 * The absolute longitude offset is cosmetic — what matters is that every port
 * and every stretch of coastline keeps its correct position RELATIVE to the
 * others, which this preserves.
 */
function latLng(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * DEG
  const theta = (lng + 180) * DEG
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

/** Piraeus — the single hub every route runs from. */
const HUB = { lat: 37.94, lng: 23.65 }

/** A spread of global hubs: enough to read as "everywhere" without clutter. */
const PORTS: { lat: number; lng: number }[] = [
  { lat: 51.95, lng: 4.14 }, // Rotterdam
  { lat: 53.55, lng: 9.99 }, // Hamburg
  { lat: 36.14, lng: -5.35 }, // Gibraltar
  { lat: 40.67, lng: -74.04 }, // New York / New Jersey
  { lat: 29.75, lng: -95.06 }, // Houston
  { lat: 8.97, lng: -79.53 }, // Panama
  { lat: -23.96, lng: -46.33 }, // Santos
  { lat: -29.87, lng: 31.02 }, // Durban
  { lat: 25.12, lng: 56.33 }, // Fujairah
  { lat: 1.26, lng: 103.82 }, // Singapore
  { lat: 31.23, lng: 121.49 }, // Shanghai
  { lat: 35.1, lng: 129.04 }, // Busan
]

/**
 * Great-circle path from a to b (both on the unit sphere), lifted into an arc
 * that peaks at the midpoint. The lift is what makes a route read as a flight
 * over the globe rather than a scratch across its surface.
 */
function greatCircle(
  a: THREE.Vector3,
  b: THREE.Vector3,
  segments = 64,
  lift = 0.18,
): THREE.Vector3[] {
  const start = a.clone().normalize()
  const end = b.clone().normalize()
  const angle = start.angleTo(end)
  const axis = new THREE.Vector3().crossVectors(start, end).normalize()
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p = start.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, angle * t))
    p.multiplyScalar(1 + Math.sin(Math.PI * t) * lift)
    pts.push(p)
  }
  return pts
}

/** Parallels and meridians every 30°, as one line-segment geometry. */
function graticuleGeometry(r = 1.001): THREE.BufferGeometry {
  const pos: number[] = []
  const seg = 90
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z)
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let i = 0; i < seg; i++) {
      push(latLng(lat, -180 + (360 * i) / seg, r))
      push(latLng(lat, -180 + (360 * (i + 1)) / seg, r))
    }
  }
  for (let lng = -180; lng < 180; lng += 30) {
    for (let i = 0; i < seg; i++) {
      push(latLng(-90 + (180 * i) / seg, lng, r))
      push(latLng(-90 + (180 * (i + 1)) / seg, lng, r))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/** Every arc merged into one line-segment geometry — the whole set in one draw. */
function arcsGeometry(curves: THREE.Vector3[][]): THREE.BufferGeometry {
  const pos: number[] = []
  for (const c of curves) {
    for (let i = 0; i < c.length - 1; i++) {
      pos.push(c[i].x, c[i].y, c[i].z, c[i + 1].x, c[i + 1].y, c[i + 1].z)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/* A view-space normal + eye direction, shared by both fresnel shaders below. */
const FRESNEL_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

/** Navy core, softly lit from one side, with a cyan glow along the limb so the
 *  sphere reads as a solid body sitting in light rather than a flat disc. */
function coreMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(COLOR.navy900) },
      uRim: { value: new THREE.Color(COLOR.signal500) },
      uLightDir: { value: new THREE.Vector3(0.4, 0.5, 0.8).normalize() },
    },
    vertexShader: FRESNEL_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uRim;
      uniform vec3 uLightDir;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float ndl = clamp(dot(vNormal, normalize(uLightDir)), 0.0, 1.0);
        vec3 base = uBase * (0.7 + 0.35 * ndl);
        float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
        gl_FragColor = vec4(base + uRim * fres * 0.85, 1.0);
      }
    `,
  })
}

/** A larger back-facing shell that lights only along the silhouette — the thin
 *  atmospheric halo that lifts the globe off the dark page. */
function atmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(COLOR.signal500) },
      uStrength: { value: 1.15 },
    },
    vertexShader: FRESNEL_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vView));
        float intensity = pow(clamp(rim, 0.0, 1.0), 3.2) * uStrength;
        gl_FragColor = vec4(uColor * intensity, intensity);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

function Globe({ animate }: { animate: boolean }) {
  const spin = useRef<THREE.Group>(null)
  const pulses = useRef<(THREE.Mesh | null)[]>([])

  const hubVec = useMemo(() => latLng(HUB.lat, HUB.lng, 1.01), [])
  const portVecs = useMemo(() => PORTS.map((p) => latLng(p.lat, p.lng, 1.01)), [])
  const curves = useMemo(() => portVecs.map((p) => greatCircle(hubVec, p)), [hubVec, portVecs])
  const graticule = useMemo(() => graticuleGeometry(), [])
  const arcs = useMemo(() => arcsGeometry(curves), [curves])
  const core = useMemo(() => coreMaterial(), [])
  const atmosphere = useMemo(() => atmosphereMaterial(), [])

  // The blueprint coastlines, baked from a real Earth photo into an
  // equirectangular line texture, wrap straight onto the sphere.
  const blueprint = useMemo(() => {
    const tex = new THREE.TextureLoader().load(earthBlueprint)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.wrapS = THREE.RepeatWrapping
    return tex
  }, [])

  // Manually built geometries/materials/textures aren't disposed by R3F.
  useEffect(() => {
    return () => {
      graticule.dispose()
      arcs.dispose()
      core.dispose()
      atmosphere.dispose()
      blueprint.dispose()
    }
  }, [graticule, arcs, core, atmosphere, blueprint])

  useFrame((state, delta) => {
    // A slow, stately spin — the globe reads as a live backdrop. The base pose
    // set on the group is just the starting frame.
    if (spin.current && animate) spin.current.rotation.y += delta * 0.08
    // A dot per route, riding its arc from Piraeus outward on a staggered loop.
    const t = animate ? state.clock.elapsedTime : 0.15
    for (let i = 0; i < pulses.current.length; i++) {
      const m = pulses.current[i]
      const c = curves[i]
      if (!m) continue
      const f = (t * 0.32 + i * 0.13) % 1
      m.position.copy(c[Math.min(c.length - 1, Math.floor(f * (c.length - 1)))])
    }
  })

  return (
    // Starting pose: the yaw turns Piraeus round to face the camera and the
    // tilt lifts it a touch above centre; from here the group spins slowly.
    <group ref={spin} rotation={[0.35, -1.985, 0]}>
      {/* Opaque, softly lit core, fractionally inside the linework, so the far
          hemisphere's coastlines, dots and arc feet are occluded. */}
      <mesh material={core}>
        <sphereGeometry args={[0.99, 64, 64]} />
      </mesh>

      {/* Atmospheric halo, drawn last-ish; sits outside the core. */}
      <mesh material={atmosphere}>
        <sphereGeometry args={[1.16, 48, 48]} />
      </mesh>

      {/* Faint graticule underneath — the technical-drawing grid — then the
          blueprint coastlines traced from a real Earth image on top. */}
      <lineSegments geometry={graticule}>
        <lineBasicMaterial color={COLOR.signal500} transparent opacity={0.1} />
      </lineSegments>
      <mesh>
        <sphereGeometry args={[1.002, 64, 64]} />
        <meshBasicMaterial map={blueprint} transparent depthWrite={false} />
      </mesh>
      <lineSegments geometry={arcs}>
        <lineBasicMaterial color={COLOR.signal300} transparent opacity={0.5} />
      </lineSegments>

      {portVecs.map((v, i) => (
        <mesh key={i} position={v}>
          <sphereGeometry args={[0.013, 12, 12]} />
          <meshBasicMaterial color={COLOR.signal300} />
        </mesh>
      ))}

      {curves.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            pulses.current[i] = m
          }}
        >
          <sphereGeometry args={[0.016, 10, 10]} />
          <meshBasicMaterial color={COLOR.signal300} />
        </mesh>
      ))}

      {/* Piraeus — the only warm mark on the globe, the way the vessel scene
          reserves amber for the one thing that matters. */}
      <mesh position={hubVec}>
        <sphereGeometry args={[0.026, 16, 16]} />
        <meshBasicMaterial color={COLOR.alert500} />
      </mesh>
    </group>
  )
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
}

/** Flat stand-in for machines without WebGL — a globe read as a wire drawing. */
function GlobeFallback() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <g fill="none" stroke={COLOR.signal500} strokeWidth="0.6" opacity="0.5">
        <circle cx="100" cy="100" r="78" />
        <ellipse cx="100" cy="100" rx="78" ry="30" />
        <ellipse cx="100" cy="100" rx="78" ry="55" />
        <ellipse cx="100" cy="100" rx="30" ry="78" />
        <ellipse cx="100" cy="100" rx="55" ry="78" />
        <line x1="22" y1="100" x2="178" y2="100" />
        <line x1="100" y1="22" x2="100" y2="178" />
      </g>
      <circle cx="118" cy="86" r="3.5" fill={COLOR.alert500} />
      {[
        [60, 70],
        [150, 92],
        [78, 132],
        [138, 140],
        [96, 52],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill={COLOR.signal300} />
      ))}
    </svg>
  )
}

/**
 * The coverage globe: Piraeus at the centre of a web of routes to global
 * shipping hubs, over real continent outlines. A single WebGL context lives on
 * this page; R3F pauses its loop when the tab is hidden.
 */
export function CoverageGlobe({ className }: { className?: string }) {
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    setWebgl(hasWebGL())
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setAnimate(!motion.matches && !E2E)
    apply()
    motion.addEventListener('change', apply)
    return () => motion.removeEventListener('change', apply)
  }, [])

  return (
    <div className={cn('relative aspect-square w-full', className)}>
      {/* Cyan bloom behind the sphere, so it sits in light rather than on a flat
          field — the same trick the page's blueprint sections use for depth. */}
      <div
        className="pointer-events-none absolute inset-[2%] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--color-signal-500) 30%, transparent), transparent 66%)',
        }}
        aria-hidden="true"
      />
      <div className="relative h-full w-full">
        {webgl === false ? (
          <GlobeFallback />
        ) : webgl ? (
          <Canvas
            camera={{ position: [0, 0, 4.2], fov: 38 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
          >
            <Globe animate={animate} />
          </Canvas>
        ) : null}
      </div>
    </div>
  )
}
