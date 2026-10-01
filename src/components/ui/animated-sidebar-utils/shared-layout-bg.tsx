import { forwardRef, type ElementType, type HTMLAttributes } from "react";

interface SharedLayoutBgProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  // Props do original (pílula compartilhada); aqui o fundo ativo usa layoutId no próprio botão.
  inset?: number;
  pillClassName?: string;
  pillContainerClassName?: string;
}

export const SharedLayoutBg = forwardRef<HTMLElement, SharedLayoutBgProps>(function SharedLayoutBg(
  { as: Tag = "div", inset: _inset, pillClassName: _p, pillContainerClassName: _c, ...props },
  ref,
) {
  return <Tag ref={ref} {...props} />;
});
