interface CoinIconProps {
  size?: number;
  className?: string;
}

export function CoinIcon({ size = 20, className }: CoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ verticalAlign: 'middle' }}
      aria-hidden="true"
    >
      {/* Верхняя корона — трапеция */}
      <polygon points="8,41 78,41 63,19 23,19" fill="#4FC3F7" />
      {/* Разделительные линии короны */}
      <line x1="23" y1="19" x2="31" y2="41" stroke="#29B6F6" strokeWidth="1.5" />
      <line x1="43" y1="19" x2="43" y2="41" stroke="#29B6F6" strokeWidth="1.5" />
      <line x1="63" y1="19" x2="55" y2="41" stroke="#29B6F6" strokeWidth="1.5" />
      {/* Левая грань короны — чуть темнее */}
      <polygon points="8,41 23,19 31,41" fill="#29B6F6" opacity="0.4" />
      {/* Нижний треугольник */}
      <polygon points="8,41 78,41 43,75" fill="#039BE5" />
      {/* Центральная линия треугольника */}
      <line x1="43" y1="41" x2="43" y2="75" stroke="#0288D1" strokeWidth="1.5" />
      {/* Боковые линии треугольника */}
      <line x1="31" y1="41" x2="43" y2="75" stroke="#0288D1" strokeWidth="1" opacity="0.5" />
      <line x1="55" y1="41" x2="43" y2="75" stroke="#0288D1" strokeWidth="1" opacity="0.5" />
      {/* Блик на верхней грани */}
      <polygon points="23,19 43,19 31,41 8,41" fill="white" opacity="0.25" />
    </svg>
  );
}
