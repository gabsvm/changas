/** Static brand artwork: no canvas redraws, animation loop or pointer listeners. */
export function MagneticRibbons() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="yalo-magnetic-art"
      viewBox="0 0 1240 840"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <linearGradient
          id="yalo-ribbon-color"
          x1="120"
          y1="500"
          x2="1120"
          y2="180"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#08A9F4" />
          <stop offset="0.55" stopColor="#12D9C5" />
          <stop offset="1" stopColor="#65EC91" />
        </linearGradient>
      </defs>
      <g stroke="url(#yalo-ribbon-color)" strokeWidth="1.5" opacity="0.24">
        <path d="M-80 650C170 80 1090 0 1180 330S480 830 350 490 1090 170 1330 480" />
        <path d="M-60 700C200 160 1090 40 1140 350S500 770 420 480 1060 210 1310 530" />
        <path d="M-40 750C260 230 1050 100 1100 380S540 730 480 480 1030 260 1290 580" />
      </g>
    </svg>
  );
}
