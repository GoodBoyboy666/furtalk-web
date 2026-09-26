import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { getRouter } from './router'
import { createQueryClient } from './lib/query'
import { initI18n } from './lib/i18n'
import './styles.css'

const queryClient = createQueryClient()

async function startApp() {
  if (import.meta.env.DEV && import.meta.env.MODE === 'mock') {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
  }

  // 在 React 挂载前完成 i18next 初始化，避免翻译键闪烁；
  // HTTP 目录加载完成后才会渲染应用。
  await initI18n()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* MotionConfig reducedMotion="user"：尊重 prefers-reduced-motion，
          减弱或禁用 transform/stagger，但保留必需的不透明度过渡。 */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={getRouter()} />
        </QueryClientProvider>
      </MotionConfig>
    </StrictMode>,
  )
}

void startApp()
