import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { publicConfigApi } from '@/lib/api/resources'
import { publicConfigQueryKey } from '@/lib/public-config'
import { applyThemeTokens, deriveThemeTokens } from '@/lib/theme'

// PublicTheme applies only Web CSS variables. The comment Widget has its own
// Shadow DOM stylesheet and does not consume this configuration.
export function PublicTheme() {
  const config = useQuery({
    queryKey: publicConfigQueryKey,
    queryFn: publicConfigApi.get,
    retry: false,
  })

  useEffect(() => {
    const root = document.documentElement
    if (!config.data) {
      applyThemeTokens(root, null)
      return
    }
    try {
      applyThemeTokens(root, deriveThemeTokens(config.data.brand_primary_color))
    } catch {
      applyThemeTokens(root, null)
    }
  }, [config.data])

  return null
}
