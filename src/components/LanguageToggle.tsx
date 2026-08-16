import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FALLBACK_LANGUAGE } from '@/lib/i18n'
import type { SupportedLanguage } from '@/lib/i18n'

const languageOptions: { value: SupportedLanguage; key: string }[] = [
  { value: 'zh-CN', key: 'language.zhCN' },
  { value: 'en', key: 'language.en' },
]

function resolveCurrentLanguage(
  resolved: string | undefined,
): SupportedLanguage {
  if (resolved === 'zh-CN' || resolved === 'en') {
    return resolved
  }
  if (resolved?.startsWith('zh')) {
    return 'zh-CN'
  }
  if (resolved?.startsWith('en')) {
    return 'en'
  }
  return FALLBACK_LANGUAGE
}

export default function LanguageToggle() {
  const { t, i18n } = useTranslation('common')
  const current = resolveCurrentLanguage(i18n.resolvedLanguage)
  const currentOption = languageOptions.find(
    (option) => option.value === current,
  )

  function selectLanguage(language: SupportedLanguage) {
    void i18n.changeLanguage(language)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('language.toggleLabel')}
            title={
              currentOption ? t(currentOption.key) : t('language.selectTitle')
            }
            className="text-muted-foreground"
          >
            <Languages className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => selectLanguage(value as SupportedLanguage)}
        >
          {languageOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {t(option.key)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
