import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

type Variant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "ghost", className, ...rest }: ButtonProps) {
  return (
    <button className={`btn btn--${variant} ${className ?? ""}`} {...rest} />
  );
}
