import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'

describe('Spinner', () => {
  it('renders an svg', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('applies size classes', () => {
    const { container: sm } = render(<Spinner size="sm" />)
    const { container: lg } = render(<Spinner size="lg" />)
    expect(sm.querySelector('svg')?.getAttribute('class')).toContain('h-4')
    expect(lg.querySelector('svg')?.getAttribute('class')).toContain('h-8')
  })
})

describe('Modal', () => {
  it('renders the title and children', () => {
    render(
      <Modal title="Test Title" onClose={() => {}}>
        <p>Modal body</p>
      </Modal>
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    render(<Modal title="Close Test" onClose={onClose}><p>x</p></Modal>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal title="Backdrop" onClose={onClose}><p>x</p></Modal>
    )
    // Click the outermost backdrop div
    fireEvent.click(container.firstChild as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(<Modal title="Esc" onClose={onClose}><p>x</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders footer when provided', () => {
    render(
      <Modal title="With Footer" onClose={() => {}}>
        <p>body</p>
      </Modal>,
    )
    expect(screen.queryByText('Save')).not.toBeInTheDocument()

    render(
      <Modal title="With Footer" onClose={() => {}} footer={<button>Save</button>}>
        <p>body</p>
      </Modal>,
    )
    expect(screen.getByText('Save')).toBeInTheDocument()
  })
})
