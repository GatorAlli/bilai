export default function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <ellipse cx="8.6" cy="6.1" rx="2.4" ry="3.3" transform="rotate(-12 8.6 6.1)" />
      <ellipse cx="15.4" cy="6.1" rx="2.4" ry="3.3" transform="rotate(12 15.4 6.1)" />
      <ellipse cx="3.9" cy="10.7" rx="1.8" ry="2.5" transform="rotate(-17 3.9 10.7)" />
      <ellipse cx="20.1" cy="10.7" rx="1.8" ry="2.5" transform="rotate(17 20.1 10.7)" />
      <path d="M12 10.8c-3.8 0-7.5 3.3-7.5 6.7 0 2 1.4 3.2 3.1 3.2 1.5 0 2.7-1.2 4.4-1.2s2.9 1.2 4.4 1.2c1.7 0 3.1-1.2 3.1-3.2 0-3.4-3.7-6.7-7.5-6.7Z" />
    </svg>
  );
}
