/**
 * Thai address formatting utility.
 * Correct Thai address order: street, ตำบล/แขวง (sub-district),
 * อำเภอ/เขต (district), จังหวัด (province), postal code.
 */

import type { ThaiAddress } from '@thai-smb-crm/shared-types';

/**
 * Formats a ThaiAddress into a single string with correct Thai ordering.
 * Only includes non-empty components, separated by spaces.
 */
export function formatThaiAddress(address: ThaiAddress): string {
  const components: string[] = [];

  if (address.street) {
    components.push(address.street);
  }
  if (address.subDistrict) {
    components.push(address.subDistrict);
  }
  if (address.district) {
    components.push(address.district);
  }
  if (address.province) {
    components.push(address.province);
  }
  if (address.postalCode) {
    components.push(address.postalCode);
  }

  return components.join(' ');
}
