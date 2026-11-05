import { useEffect, useState } from 'react'
import AnalysisSkeleton from './AnalysisSkeleton'

const MESSAGES = [
  'Reading the product page…',
  'Extracting materials and packaging…',
  'Scoring the evidence we found…',
]

export default function LoadingTab() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % MESSAGES.length)
    }, 900)
    return () => window.clearInterval(timer)
  }, [])

  return <AnalysisSkeleton message={MESSAGES[index]} />
}