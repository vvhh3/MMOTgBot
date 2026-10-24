import { animate,useReducedMotion } from "motion/react"
import { useEffect,useLayoutEffect,useRef,useState } from "react"
import type { Location } from "react-router-dom"

const normalize = (path: string) => path.toLowerCase().replace(/\/+$/, "") || "/"
const isBattle = (path: string) => ["/takeawalk", "/fight"].includes(path)

const getGrid = () => {
  const columns = Math.max(1, Math.ceil(window.innerWidth / 48))
  const rows = Math.max(1, Math.ceil(window.innerHeight / (window.innerWidth / columns)))
  return { columns, rows }
}

// A directional wave with a scattered edge, consistent for cover and reveal.
const pixelDelay = (index: number, columns: number, rows: number, direction: number) => {
  const column = index % columns
  const progress = (direction === -1 ? columns - 1 - column : column) / Math.max(1, columns - 1)
  const scatter = ((index * 73 + Math.floor(index / columns) * 37) % 101) / 100
  return 0.04 + progress * 0.28 + scatter * 0.18 + (Math.floor(index / columns) / rows) * 0.04
}

type PageCurtainProps = {
  target: Location
  displayed: Location
  onCovered: (location: Location) => void
  ready: boolean
}

// Keep the previous route mounted until the curtain has covered the viewport.
export default function PageCurtain({ target, displayed, onCovered, ready }: PageCurtainProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<"idle" | "covering" | "covered">("idle")
  const [grid, setGrid] = useState(getGrid)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (phase !== "idle") return
    const resize = () => setGrid(getGrid())
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [phase])
  const direction = normalize(target.pathname) === "/" ? 1 : -1
  const travel = useRef(direction)

  useLayoutEffect(() => {
    if (target === displayed) return
    const from = normalize(displayed.pathname)
    const to = normalize(target.pathname)
    const isLocationTravel = from === "/map" && to === "/" && target.state?.transition === "location"
    const shouldAnimate = (from === "/" && isBattle(to)) || (isBattle(from) && to === "/") || isLocationTravel

    if (reducedMotion || !shouldAnimate || !panel.current) {
      setPhase("idle")
      onCovered(target)
      return
    }

    travel.current = direction
    setPhase("covering")
    let cancelled = false
    const animation = animate(panel.current.querySelectorAll<HTMLDivElement>("[data-pixel]"), { opacity: [0, 1] }, {
      duration: 0,
      delay: (index) => pixelDelay(index, grid.columns, grid.rows, direction),
    })
    void animation.then(() => {
      if (cancelled) return
      onCovered(target)
      setPhase("covered")
    })
    return () => {
      cancelled = true
      animation.stop()
    }
  }, [target, displayed, onCovered, reducedMotion, direction, grid])

  useLayoutEffect(() => {
    if (phase !== "covered" || target !== displayed || !ready || !panel.current) return
    let cancelled = false
    const animation = animate(panel.current.querySelectorAll<HTMLDivElement>("[data-pixel]"), { opacity: [1, 0] }, {
      duration: 0,
      delay: (index) => reducedMotion ? 0 : pixelDelay(index, grid.columns, grid.rows, travel.current),
    })
    void animation.then(() => { if (!cancelled) setPhase("idle") })
    return () => {
      cancelled = true
      animation.stop()
    }
  }, [phase, target, displayed, ready, reducedMotion, grid])

  return (
    <div aria-hidden="true" style={{
      position: "fixed", inset: 0, zIndex: 2147483647,
      overflow: "hidden", pointerEvents: phase === "idle" ? "none" : "auto",
      visibility: phase === "idle" ? "hidden" : "visible",
      touchAction: "none",
    }}>
      <div ref={panel} style={{
        position: "absolute", inset: 0, display: "grid",
        gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
      }}>
        {Array.from({ length: grid.columns * grid.rows }, (_, index) => (
          <div key={index} data-pixel="" style={{
            background: "#E8603C", opacity: 0,
            // Overlap fractional grid edges to keep the covered screen opaque.
            margin: "-0.5px",
          }} />
        ))}
      </div>
    </div>
  )
}
