import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "size-8", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
        <Image 
          src="/logo.png" 
          alt="AivaSpa Logo" 
          fill
          className="object-contain"
          priority
        />
      </div>
      {showText && (
        <span className="text-lg font-semibold tracking-tight text-[#F7F8F8]">
          AivaSpa
        </span>
      )}
    </div>
  );
}
