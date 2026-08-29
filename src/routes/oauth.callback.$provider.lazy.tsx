import { createLazyFileRoute } from '@tanstack/react-router'
import { OAuthCallbackPage } from '@/pages/oauth.callback.$provider'

export const Route = createLazyFileRoute('/oauth/callback/$provider')({
  component: OAuthCallbackPage,
})
