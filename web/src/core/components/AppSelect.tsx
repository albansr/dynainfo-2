import { Select } from '@heroui/react';
import type { ComponentProps } from 'react';

type SelectProps = ComponentProps<typeof Select>;

/**
 * HeroUI `Select` with the app's shared styling baked in: bordered variant,
 * pointer cursor on the trigger, and a z-50 popover. Use this instead of raw
 * `Select` so the config isn't copy-pasted across every dropdown.
 */
export function AppSelect({ classNames, popoverProps, ...props }: SelectProps) {
  return (
    <Select
      variant="bordered"
      classNames={{ trigger: 'cursor-pointer !border', ...classNames }}
      popoverProps={{ classNames: { content: 'z-50 cursor-pointer' }, ...popoverProps }}
      {...props}
    />
  );
}
