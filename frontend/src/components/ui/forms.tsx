import { Search } from 'lucide-react'
import type {
  ComponentPropsWithoutRef, ReactNode,
} from 'react'

export function FormField({
  label,
  children,
  className = '',
  error,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
  error?: string
}) {
  return <label className={className}>{label}{children}{error && <small className="field-error">{error}</small>}</label>
}

export function Input(props: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} />
}

export function Select(props: ComponentPropsWithoutRef<'select'>) {
  return <select {...props} />
}

export function Textarea(props: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea {...props} />
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return <label className={`search ${className}`}><Search /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>
}

export interface TabOption<T extends string> {
  value: T
  label: ReactNode
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel = 'Filter',
}: {
  value: T
  options: readonly TabOption<T>[]
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return <div className="tabs" role="tablist" aria-label={ariaLabel}>{options.map((option) => <button key={option.value} type="button" role="tab" aria-selected={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
}

export function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
  label,
}: {
  value: number
  onDecrement: () => void
  onIncrement: () => void
  label: string
}) {
  return <div className="quantity"><button type="button" aria-label={`Remove one ${label}`} onClick={onDecrement}>−</button><span>{value}</span><button type="button" aria-label={`Add one ${label}`} onClick={onIncrement}>+</button></div>
}
