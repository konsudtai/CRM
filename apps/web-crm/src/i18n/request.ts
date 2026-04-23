import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

const SUPPORTED_LOCALES = ['th', 'en'] as const;
const DEFAULT_LOCALE = 'th';

export default getRequestConfig(async () => {
  // Check cookie first, then Accept-Language header, default to Thai
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;

  let locale: string = DEFAULT_LOCALE;

  if (localeCookie && SUPPORTED_LOCALES.includes(localeCookie as any)) {
    locale = localeCookie;
  } else {
    const headerStore = await headers();
    const acceptLang = headerStore.get('accept-language') ?? '';
    const preferred = acceptLang.split(',')[0]?.split('-')[0]?.trim();
    if (preferred && SUPPORTED_LOCALES.includes(preferred as any)) {
      locale = preferred;
    }
  }

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});
