import { X } from 'lucide-react'
import type {
  ButtonHTMLAttributes, HTMLAttributes, ReactNode,
} from 'react'
import { label } from '../../lib/helpers'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />
}

export function IconButton({
  label: accessibleLabel,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={`icon-button ${className}`} aria-label={accessibleLabel} {...props} />
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props}>{children}</section>
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string
  subtitle: string
  eyebrow?: string
  actions?: ReactNode
}) {
  return <header className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="actions">{actions}</div>}</header>
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton label="Close" onClick={onClose}><X /></IconButton></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  pending,
  danger = false,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  pending?: boolean
  danger?: boolean
}) {
  if (!open) return null
  return <Modal title={title} onClose={onClose}><p className="modal-copy">{description}</p><div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} disabled={pending} onClick={onConfirm}>{confirmLabel}</Button></div></Modal>
}

const badgeTone: Record<string, BadgeTone> = {
  placed: 'amber', confirmed: 'blue', packed: 'blue', out_for_delivery: 'amber',
  delivered: 'green', paid: 'green', cancelled: 'gray', unpaid: 'amber',
  available: 'green', near_expiry: 'amber', expired: 'red', quarantined: 'red',
}
export type BadgeTone = 'green' | 'amber' | 'blue' | 'gray' | 'red'

export function Badge({ value, tone }: { value: string; tone?: BadgeTone }) {
  return <span className={`badge ${tone ?? badgeTone[value] ?? 'gray'}`}>{label(value)}</span>
}

export const StatusBadge = Badge

export function Notice({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'amber' }) {
  return <div className={`notice ${tone === 'amber' ? 'amber' : ''}`}>{children}</div>
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong><p>{children}</p>{action}</div>
}

export const Empty = EmptyState

export function Spinner() {
  return <span className="loader" aria-hidden="true" />
}

export function Loading({ label = 'Loading workspace…' }: { label?: string }) {
  return <main className="loading"><Spinner /><p>{label}</p></main>
}

export function Avatar({ name, title }: { name: string; title?: string }) {
  return <span className="avatar" title={title}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
}

export function ToastVisual({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' }) {
  return <div className={`toast ${tone}`} role="status">{message}</div>
}

export function ProgressBar({ value, max = 100, label: ariaLabel }: { value: number; max?: number; label?: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0
  return <div className="credit-meter" role="progressbar" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{ width: `${percent}%` }} /></div>
}
