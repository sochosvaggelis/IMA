/**
 * The vessel's blueprint linework, extracted off the main thread.
 *
 * EdgesGeometry walks every one of the hull's ~200k triangles and hashes
 * every edge: ~300ms on a fast desktop, well over a second on a mid-range
 * phone. On the main thread that was the single biggest block in the home
 * page's load — nothing could paint or respond while it ran, including the
 * intro curtain that exists to cover this very wait.
 *
 * Same three.js EdgesGeometry, same input, same angle: the output is the same
 * array the main thread used to compute, so the drawing is unchanged.
 */
import { BufferAttribute, BufferGeometry, EdgesGeometry } from 'three'

export type EdgesRequest = {
  position: { array: Float32Array; itemSize: number; normalized: boolean }
  index: Uint16Array | Uint32Array | null
  angle: number
}

// Typed by hand: the app's tsconfig has the DOM lib, not WebWorker, and this
// is the whole of the worker API used here.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<EdgesRequest>) => void) | null
  postMessage(message: Float32Array, transfer: Transferable[]): void
}

scope.onmessage = ({ data }) => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(data.position.array, data.position.itemSize, data.position.normalized),
  )
  if (data.index) geometry.setIndex(new BufferAttribute(data.index, 1))

  const edges = new EdgesGeometry(geometry, data.angle)
  const positions = edges.getAttribute('position').array as Float32Array
  scope.postMessage(positions, [positions.buffer])
}
