import Sidebar from './Sidebar'
import Header from './Header'
import KeyboardShortcutsOverlay from '@/components/common/KeyboardShortcutsOverlay'
import GlobalSearch from '@/components/common/GlobalSearch'
import ActivityPanel from '@/components/common/ActivityPanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useActivityStore } from '@/store/activities'

function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  return <>{children}</>
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { panelOpen, activities } = useActivityStore()
  // When the activity panel is open, shrink the main area
  const panelWidth = panelOpen && activities.length > 0 ? 520 : 0

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      {/* Main content — shrinks when activity panel is open */}
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-200"
        style={{ marginRight: panelWidth }}
      >
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ShortcutsProvider>
            {children}
          </ShortcutsProvider>
        </main>
      </div>

      {/* Global overlays */}
      <KeyboardShortcutsOverlay />
      <GlobalSearch />

      {/* Activities Panel — floats on the right */}
      <ActivityPanel />
    </div>
  )
}
