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
      aria-hidden="true"
    >
      {/* Нижняя часть — 4 грани */}
      <polygon points="8,38 50,38 30,95" fill="#155547" />
      <polygon points="50,38 92,38 70,95" fill="#0D4F40" />
      <polygon points="50,38 30,95 50,95" fill="#1B6B58" />
      <polygon points="50,38 70,95 50,95" fill="#134E3E" />
      {/* Верхняя часть — 3 грани */}
      <polygon points="8,38 50,5 50,38" fill="#26A69A" />
      <polygon points="50,5 92,38 50,38" fill="#1E8C7A" />
      <polygon points="30,12 50,5 50,38 8,38" fill="#FFD54F" opacity="0.5" />
    </svg>
  );
}
