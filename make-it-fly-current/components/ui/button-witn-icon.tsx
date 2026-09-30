import type { MouseEventHandler, ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import styles from "./button-witn-icon.module.css"

type ButtonWithIconProps = {
  children: ReactNode
  className?: string
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  prefetch?: boolean
  type?: "button" | "submit" | "reset"
}

const baseClassName =
  "group relative h-12 w-fit cursor-pointer overflow-hidden rounded-full p-1 ps-6 pe-14 text-sm font-medium transition-all duration-500 hover:ps-14 hover:pe-6 motion-reduce:transition-none"

const ButtonWithIcon = ({
  children,
  className,
  href,
  onClick,
  prefetch,
  type = "button",
}: ButtonWithIconProps) => {
  const content = (
    <>
      <span className={cn(styles.label, "relative z-10 transition-all duration-500 motion-reduce:transition-none")}>
        {children}
      </span>
      <span
        aria-hidden="true"
        className={cn(styles.icon, "absolute right-1 flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground transition-all duration-500 group-hover:right-[calc(100%-44px)] group-hover:rotate-45 motion-reduce:transition-none")}
      >
        <ArrowUpRight size={16} />
      </span>
    </>
  )

  if (href) {
    return (
      <Button asChild className={cn(baseClassName, styles.button, className)}>
        <Link
          href={href}
          onClick={onClick as MouseEventHandler<HTMLAnchorElement>}
          prefetch={prefetch}
        >
          {content}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      className={cn(baseClassName, styles.button, className)}
      onClick={onClick as MouseEventHandler<HTMLButtonElement>}
      type={type}
    >
      {content}
    </Button>
  )
}

export default ButtonWithIcon
