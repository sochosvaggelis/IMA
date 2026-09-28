/** The panel's own small lockup. Not the site's Logo: that one is a target
    of the home page's intro animation (data-logo-mark), and has no business
    being measured or hidden by it in here. */
export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={`${import.meta.env.BASE_URL}logo-signal.png`}
        alt=""
        width={153}
        height={160}
        className="h-9 w-auto shrink-0"
      />
      <span className="text-base leading-none font-bold tracking-tight text-white">IMA</span>
      <span className="text-signal-400 border-signal-500/40 rounded border px-1.5 py-0.5 font-mono text-[0.6875rem] tracking-[0.12em] uppercase">
        Admin
      </span>
    </span>
  )
}
