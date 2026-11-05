import ErrorBoundary from '../components/ErrorBoundary'
import SidePanel from './SidePanel'

/**
 * Side panel entry point.
 *
 * The analysis screen renders from the shared detection + TerraScore pipeline
 * (the same services the popup uses), so a detected product always produces a
 * visible state: loading, ready, incomplete, empty or error — never a blank area.
 */
export function App() {
  return (
    <ErrorBoundary label="TerraCart could not load this view">
      <SidePanel />
    </ErrorBoundary>
  )
}

export default App