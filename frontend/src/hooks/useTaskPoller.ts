import { useEffect, useRef, useState } from 'react'
import { getTask, TaskResponse } from '../api/client'

const POLL_INTERVAL = 2000
const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function useTaskPoller(taskId: string | null) {
  const [task, setTask] = useState<TaskResponse | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setElapsed(0)
      startRef.current = null
      return
    }

    startRef.current = Date.now()
    setElapsed(0)

    const poll = async () => {
      try {
        const data = await getTask(taskId, true)
        setTask(data)
        const now = Date.now()
        setElapsed(Math.floor((now - startRef.current!) / 1000))
        if (data.status === 'finished' || data.status === 'failed') {
          clearInterval(timer)
        }
        if (now - startRef.current! > TIMEOUT_MS) {
          clearInterval(timer)
          setTask(prev => prev ? { ...prev, status: 'failed', result: { error: { type: 'Timeout', message: 'Polling timed out after 30 minutes.', traceback: '' } } } : prev)
        }
      } catch {
        // network error — keep polling
      }
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [taskId])

  return { task, elapsed }
}
