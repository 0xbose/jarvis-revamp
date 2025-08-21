import { SVGProps, Ref, forwardRef, memo } from "react"
const SvgComponent = (
  props: SVGProps<SVGSVGElement>,
  ref: Ref<SVGSVGElement>
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    ref={ref}
    {...props}
  >
    <path
      fill="currentColor"
      d="M12 14.25a3 3 0 0 0 3-3h6v-4.5a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6.75v4.5h6a3 3 0 0 0 3 3Z"
      opacity={0.2}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.623}
      d="M19.5 5.25h-15A1.5 1.5 0 0 0 3 6.75v10.5a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.623}
      d="M3 11.25h3.644c1.301 0 2.315 1.201 3.235 2.121v0a3 3 0 0 0 4.242 0v0c.92-.92 1.934-2.121 3.235-2.121H21M3 8.25h18"
    />
  </svg>
)
const ForwardRef = forwardRef(SvgComponent)
const Memo = memo(ForwardRef)
export { Memo as WalletIcon }
