import { ReactNode, useState } from 'react'
import { Modal } from '../ui/Modal'

interface HelpButtonProps {
  title: string
  children: ReactNode
}

export function HelpButton({ title, children }: HelpButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 text-xs transition-colors flex-shrink-0 leading-none"
        title={`Help: ${title}`}
        aria-label={`Help: ${title}`}
      >
        ?
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="text-sm text-zinc-300 space-y-3 leading-relaxed">
            {children}
          </div>
        </Modal>
      )}
    </>
  )
}
