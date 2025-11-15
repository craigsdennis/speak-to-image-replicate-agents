import { useEffect, useState } from 'react'
import { CreateImagePage } from './pages/CreateImagePage'
import { ImageDetailsPage } from './pages/ImageDetailsPage'

const getInitialPathname = () => (typeof window === 'undefined' ? '/' : window.location.pathname)

function App() {
  const [pathname, setPathname] = useState(getInitialPathname)

  useEffect(() => {
    const handlePopstate = () => setPathname(getInitialPathname())
    window.addEventListener('popstate', handlePopstate)
    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  if (pathname.startsWith('/images/')) {
    const imageId = decodeURIComponent(pathname.replace('/images/', '').split('/').filter(Boolean)[0] ?? '')
    return <ImageDetailsPage imageId={imageId} />
  }

  return <CreateImagePage />
}

export default App
