"use client";
// Origem: 21st.dev · starc007/animated-sidebar (sem submenus — o hub tem navegação plana).

import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  createContext,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { SharedLayoutBg } from "@/components/ui/animated-sidebar-utils/shared-layout-bg";
import {
  EASE_DRAWER,
  EASE_OUT,
  SPRING_LAYOUT,
  SPRING_PRESS,
} from "@/components/ui/animated-sidebar-utils/ease";
import { cn } from "@/lib/utils";

type SidebarSide = "left" | "right";

const MOBILE_QUERY = "(max-width: 767px)";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const PANEL_TRANSITION = { duration: 0.36, ease: EASE_DRAWER } as const;
const SIDEBAR_MORPH_TRANSITION = {
  type: "spring",
  stiffness: 380,
  damping: 35,
  mass: 0.75,
} as const;
const LABEL_ENTER_TRANSITION = { duration: 0.2, delay: 0.08, ease: EASE_OUT } as const;
const LABEL_EXIT_TRANSITION = { duration: 0.12, ease: EASE_OUT } as const;
const REDUCED_TRANSITION = { duration: 0.16, ease: EASE_OUT } as const;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function subscribeToMobileQuery(callback: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribeToMobileQuery,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

interface AnimatedSidebarContextValue {
  isMobile: boolean;
  layoutId: string;
  open: boolean;
  openMobile: boolean;
  reduce: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const AnimatedSidebarContext = createContext<AnimatedSidebarContextValue | null>(null);
const AnimatedSidebarPanelContext = createContext<{ collapsed: boolean } | null>(null);

export function useAnimatedSidebar() {
  const context = useContext(AnimatedSidebarContext);
  if (!context) throw new Error("useAnimatedSidebar must be used inside AnimatedSidebarProvider.");
  return context;
}

function useAnimatedSidebarPanel() {
  const context = useContext(AnimatedSidebarPanelContext);
  if (!context) throw new Error("Animated Sidebar parts must be used inside AnimatedSidebar.");
  return context;
}

type SidebarProviderStyle = CSSProperties & {
  "--sidebar-width"?: string;
  "--sidebar-width-icon"?: string;
  "--sidebar-width-mobile"?: string;
};

export interface AnimatedSidebarProviderProps extends HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  style?: SidebarProviderStyle;
}

export function AnimatedSidebarProvider({
  children,
  defaultOpen = true,
  className,
  style,
  ...props
}: AnimatedSidebarProviderProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);
  const isMobile = useIsMobile();
  const reduce = useReducedMotion() ?? false;
  const generatedId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggleSidebar = useCallback(() => {
    if (isMobile) setOpenMobile((v) => !v);
    else setOpen((v) => !v);
  }, [isMobile]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [toggleSidebar]);

  return (
    <AnimatedSidebarContext.Provider
      value={{
        isMobile,
        layoutId: `${generatedId}-active`,
        open,
        openMobile,
        reduce,
        setOpen,
        setOpenMobile,
        toggleSidebar,
        triggerRef,
      }}
    >
      <div
        {...props}
        data-slot="sidebar-wrapper"
        data-state={open ? "expanded" : "collapsed"}
        style={{
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "4.25rem",
          "--sidebar-width-mobile": "18rem",
          ...style,
        }}
        className={cn("group/sidebar-wrapper flex min-h-svh w-full min-w-0", className)}
      >
        {children}
      </div>
    </AnimatedSidebarContext.Provider>
  );
}

function MobileSidebar({
  ariaLabel,
  children,
  className,
  side,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string | undefined;
  side: SidebarSide;
}) {
  const context = useAnimatedSidebar();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(!context.openMobile);
  const openMobileRef = useRef(context.openMobile);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    openMobileRef.current = context.openMobile;
    if (context.openMobile) setHidden(false);
  }, [context.openMobile]);

  useEffect(() => {
    if (!context.openMobile) return;
    const focusFrame = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panelRef.current)?.focus({ preventScroll: true });
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      context.triggerRef.current?.focus({ preventScroll: true });
    };
  }, [context.openMobile, context.triggerRef]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed left-0 top-0 z-50 size-0 md:hidden",
        hidden && !context.openMobile ? "invisible" : "visible",
      )}
    >
      <motion.button
        type="button"
        aria-label="Fechar menu"
        tabIndex={context.openMobile ? 0 : -1}
        initial={false}
        animate={{ opacity: context.openMobile ? 1 : 0 }}
        transition={context.reduce ? REDUCED_TRANSITION : PANEL_TRANSITION}
        onClick={() => context.setOpenMobile(false)}
        className={cn(
          "fixed inset-0 bg-black/40",
          context.openMobile ? "pointer-events-auto" : "pointer-events-none",
        )}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!context.openMobile}
        inert={!context.openMobile}
        tabIndex={-1}
        data-mobile="true"
        initial={false}
        animate={{
          opacity: context.reduce ? (context.openMobile ? 1 : 0) : 1,
          x: context.reduce ? 0 : context.openMobile ? "0%" : side === "left" ? "-100%" : "100%",
        }}
        transition={context.reduce ? REDUCED_TRANSITION : PANEL_TRANSITION}
        onAnimationComplete={() => {
          if (!openMobileRef.current) setHidden(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            context.setOpenMobile(false);
          }
        }}
        className={cn(
          "pointer-events-auto fixed inset-y-0 flex h-dvh w-(--sidebar-width-mobile) max-w-[88vw] flex-col overflow-hidden",
          "border-border bg-background shadow-2xl will-change-transform",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          !context.openMobile && "pointer-events-none",
          className,
        )}
      >
        <AnimatedSidebarPanelContext.Provider value={{ collapsed: false }}>
          {children}
        </AnimatedSidebarPanelContext.Provider>
      </motion.div>
    </div>,
    document.body,
  );
}

export interface AnimatedSidebarProps extends Omit<HTMLMotionProps<"aside">, "children"> {
  children?: ReactNode;
  side?: SidebarSide;
  ariaLabel?: string;
  panelClassName?: string;
}

export const AnimatedSidebar = forwardRef<HTMLElement, AnimatedSidebarProps>(
  function AnimatedSidebar(
    { side = "left", ariaLabel = "Menu", children, className, panelClassName, style, ...props },
    forwardedRef,
  ) {
    const context = useAnimatedSidebar();
    const collapsed = !context.open;
    const width = collapsed ? "var(--sidebar-width-icon)" : "var(--sidebar-width)";

    if (context.isMobile) {
      return (
        <MobileSidebar ariaLabel={ariaLabel} className={className} side={side}>
          {children}
        </MobileSidebar>
      );
    }

    return (
      <motion.aside
        {...props}
        ref={forwardedRef}
        initial={false}
        aria-label={ariaLabel}
        data-slot="sidebar"
        data-state={collapsed ? "collapsed" : "expanded"}
        data-side={side}
        animate={{ width }}
        transition={context.reduce ? { duration: 0 } : SIDEBAR_MORPH_TRANSITION}
        {...(style ? { style } : {})}
        className={cn(
          "group/sidebar relative hidden h-auto shrink-0 md:block will-change-[width]",
          className,
        )}
      >
        <div
          className={cn(
            "sticky top-0 flex h-svh w-full flex-col overflow-hidden border-r border-border bg-sidebar",
            panelClassName,
          )}
        >
          <AnimatedSidebarPanelContext.Provider value={{ collapsed }}>
            {children}
          </AnimatedSidebarPanelContext.Provider>
        </div>
      </motion.aside>
    );
  },
);

export const AnimatedSidebarTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function AnimatedSidebarTrigger({ className, onClick, type = "button", ...props }, forwardedRef) {
  const context = useAnimatedSidebar();
  const expanded = context.isMobile ? context.openMobile : context.open;

  return (
    <button
      {...props}
      ref={(node) => {
        context.triggerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      type={type}
      aria-label={props["aria-label"] ?? "Alternar menu"}
      aria-expanded={expanded}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.toggleSidebar();
      }}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
});

export const AnimatedSidebarClose = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function AnimatedSidebarClose({ className, onClick, type = "button", ...props }, forwardedRef) {
  const context = useAnimatedSidebar();
  return (
    <button
      {...props}
      ref={forwardedRef}
      type={type}
      aria-label={props["aria-label"] ?? "Fechar menu"}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (context.isMobile) context.setOpenMobile(false);
        else context.setOpen(false);
      }}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
});

export const AnimatedSidebarInset = forwardRef<HTMLElement, HTMLMotionProps<"main">>(
  function AnimatedSidebarInset({ className, ...props }, forwardedRef) {
    return (
      <motion.main
        {...props}
        ref={forwardedRef}
        data-slot="sidebar-inset"
        className={cn("relative flex min-h-svh min-w-0 flex-1 flex-col bg-background", className)}
      />
    );
  },
);

export const AnimatedSidebarHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AnimatedSidebarHeader({ className, ...props }, ref) {
    return (
      <div {...props} ref={ref} className={cn("flex shrink-0 flex-col gap-2 p-3", className)} />
    );
  },
);

export const AnimatedSidebarContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AnimatedSidebarContent({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2",
          className,
        )}
      />
    );
  },
);

export const AnimatedSidebarFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AnimatedSidebarFooter({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          "flex shrink-0 flex-col gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          className,
        )}
      />
    );
  },
);

export const AnimatedSidebarGroupLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AnimatedSidebarGroupLabel({ children, className, ...props }, ref) {
    const { collapsed } = useAnimatedSidebarPanel();
    return (
      <div
        {...props}
        ref={ref}
        aria-hidden={collapsed}
        className={cn(
          "mb-1 h-7 overflow-hidden px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-opacity",
          collapsed ? "opacity-0" : "opacity-100",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

export const AnimatedSidebarMenu = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement>>(
  function AnimatedSidebarMenu({ children, className, ...props }, ref) {
    return (
      <SharedLayoutBg
        {...props}
        ref={ref as React.Ref<HTMLElement>}
        as="ul"
        className={cn("flex w-full min-w-0 list-none flex-col gap-0.5", className)}
      >
        {children}
      </SharedLayoutBg>
    );
  },
);

export const AnimatedSidebarMenuItem = forwardRef<HTMLLIElement, HTMLMotionProps<"li">>(
  function AnimatedSidebarMenuItem({ className, ...props }, ref) {
    return (
      <motion.li
        {...props}
        ref={ref}
        layout="position"
        transition={SPRING_LAYOUT}
        className={cn("relative", className)}
      />
    );
  },
);

export interface AnimatedSidebarMenuButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  /** Rota do TanStack Router; sem `to`, renderiza um botão. */
  to?: string;
  isActive?: boolean;
  onSelect?: () => void;
  className?: string;
}

const MotionLink = motion.create(Link);

export function AnimatedSidebarMenuButton({
  children,
  icon,
  badge,
  to,
  isActive = false,
  onSelect,
  className,
}: AnimatedSidebarMenuButtonProps) {
  const context = useAnimatedSidebar();
  const panel = useAnimatedSidebarPanel();
  const textLabel = typeof children === "string" ? children : undefined;

  const select = () => {
    onSelect?.();
    if (context.isMobile) context.setOpenMobile(false);
  };

  const content = (
    <>
      {isActive ? (
        <motion.span
          layoutId={context.layoutId}
          transition={context.reduce ? { duration: 0 } : SPRING_LAYOUT}
          className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/20"
        />
      ) : null}
      {icon ? (
        <span aria-hidden="true" className="relative z-10 grid size-5 shrink-0 place-items-center">
          {icon}
        </span>
      ) : null}
      <motion.span
        initial={false}
        animate={{ opacity: panel.collapsed ? 0 : 1, x: panel.collapsed ? -4 : 0 }}
        transition={
          context.reduce
            ? REDUCED_TRANSITION
            : panel.collapsed
              ? LABEL_EXIT_TRANSITION
              : LABEL_ENTER_TRANSITION
        }
        aria-hidden={panel.collapsed}
        className={cn(
          "relative z-10 min-w-0 flex-1 truncate",
          panel.collapsed && "pointer-events-none",
        )}
      >
        {children}
      </motion.span>
      {badge && !panel.collapsed ? (
        <span className="relative z-10 shrink-0 text-xs text-muted-foreground">{badge}</span>
      ) : null}
    </>
  );

  const cls = cn(
    "relative flex min-h-10 w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-sm font-medium outline-none",
    "text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
    isActive && "text-primary",
    className,
  );

  return to ? (
    <MotionLink
      to={to}
      aria-current={isActive ? "page" : undefined}
      aria-label={panel.collapsed ? textLabel : undefined}
      title={panel.collapsed ? textLabel : undefined}
      onClick={select}
      whileTap={context.reduce ? {} : { scale: 0.98 }}
      transition={SPRING_PRESS}
      className={cls}
    >
      {content}
    </MotionLink>
  ) : (
    <motion.button
      type="button"
      aria-current={isActive ? "page" : undefined}
      aria-label={panel.collapsed ? textLabel : undefined}
      title={panel.collapsed ? textLabel : undefined}
      onClick={select}
      whileTap={context.reduce ? {} : { scale: 0.98 }}
      transition={SPRING_PRESS}
      className={cls}
    >
      {content}
    </motion.button>
  );
}
