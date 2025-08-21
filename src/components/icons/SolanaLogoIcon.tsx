import { SVGProps, Ref, forwardRef, memo } from "react"
const SvgComponent = (
  props: SVGProps<SVGSVGElement>,
  ref: Ref<SVGSVGElement>
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={22}
    height={22}
    viewBox="0 0 54 48"
    fill="none"
    ref={ref}
    {...props}
  >
    <path
      fill="hsl(var(--foreground))"
      d="m53.535 38.05-8.86 9.51a2.101 2.101 0 0 1-1.51.65h-42a1 1 0 0 1-.75-1.73l8.85-9.5a2.069 2.069 0 0 1 1.51-.66h42a1 1 0 0 1 .76 1.73Zm-8.86-19.13a2.06 2.06 0 0 0-1.51-.65h-42A1 1 0 0 0 .414 20l8.85 9.5a2.06 2.06 0 0 0 1.51.65h42a1 1 0 0 0 .76-1.73l-8.86-9.5ZM1.165 12.1h42a2.072 2.072 0 0 0 1.51-.66l8.86-9.5a1 1 0 0 0-.76-1.73h-42a2.1 2.1 0 0 0-1.51.65l-8.85 9.51a1 1 0 0 0 .75 1.73Z"
    />
  </svg>
)
const ForwardRef = forwardRef(SvgComponent)
const Memo = memo(ForwardRef)
export { Memo as SolanaLogoIcon }
