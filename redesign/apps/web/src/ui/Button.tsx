import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

const styles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white border border-accent hover:bg-accent-dark hover:border-accent-dark hover:text-white',
  secondary: 'bg-white text-accent border border-accent hover:bg-accent-soft',
  quiet: 'bg-transparent text-accent border border-transparent underline underline-offset-2 hover:text-accent-dark',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra = '') {
  return `inline-flex items-center justify-center gap-2 rounded-ui px-4 py-2 min-h-11 text-base font-bold no-underline text-center disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]} ${extra}`;
}

type Props = { variant?: ButtonVariant; children: ReactNode; className?: string } & (
  | ({ to: string } & { type?: never; onClick?: never; disabled?: never })
  | ({ to?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
);

/** One primary action per screen; secondary and quiet for the rest. Pass `to` for a link that looks like a button. */
export function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  if (rest.to !== undefined)
    return (
      <Link to={rest.to} className={buttonClass(variant, className)}>
        {children}
      </Link>
    );
  const { to: _to, type = 'button', ...buttonProps } = rest;
  void _to;
  return (
    <button type={type} className={buttonClass(variant, className)} {...buttonProps}>
      {children}
    </button>
  );
}
