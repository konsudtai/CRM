const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@thai-smb-crm/ui-components', '@thai-smb-crm/utils', '@thai-smb-crm/shared-types'],
};

module.exports = withNextIntl(nextConfig);
