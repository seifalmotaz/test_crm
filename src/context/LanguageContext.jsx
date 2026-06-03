import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import dict from '../i18n/translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('crm_lang') || 'en')

  const setLang = useCallback((l) => {
    setLangState(l)
    localStorage.setItem('crm_lang', l)
  }, [])

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dir = dir
    document.documentElement.lang = lang
    document.body.style.fontFamily = lang === 'ar'
      ? "'Cairo', 'Noto Sans Arabic', sans-serif"
      : ''
  }, [lang])

  // t('nav.dashboard') → looks up dict[lang].nav.dashboard
  const t = useCallback((key) => {
    const parts = key.split('.')
    let val = dict[lang]
    for (const p of parts) {
      if (val == null) return key
      val = val[p]
    }
    return val ?? key
  }, [lang])

  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const isRTL = lang === 'ar'

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
