export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';
export const APP_NAME = 'DynaInfo';
export const OTP_EXPIRY_MINUTES = 10;

/** Production web hosts: the demo role switcher never appears (or applies) there. */
const PRODUCTION_HOSTS = ['dynainfo.com.co', 'www.dynainfo.com.co'];

/** Whether the demo role switcher is available on the current site (dev/preview/local only). */
export function isDemoRoleEnabled(hostname: string = window.location.hostname): boolean {
  return !PRODUCTION_HOSTS.includes(hostname);
}
