import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { cn } from "../../lib/utils";

export const Segmented = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-md border border-border bg-bg p-1",
      className,
    )}
    {...props}
  />
));
Segmented.displayName = "Segmented";

export const SegmentedItem = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm px-3 text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-bg-elevated data-[state=checked]:text-fg data-[state=checked]:shadow-sm",
      className,
    )}
    {...props}
  >
    {children}
  </RadioGroupPrimitive.Item>
));
SegmentedItem.displayName = "SegmentedItem";
