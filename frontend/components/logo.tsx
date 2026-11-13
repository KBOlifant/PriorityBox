import Image from "next/image";
import logo from "@/assets/PriorityBoxLogo.png";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src={logo}
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
      className="shrink-0 object-contain"
    />
  );
}
