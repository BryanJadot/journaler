// next.config.mjs
import createAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = createAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
  analyzerMode: 'static',
});

export default withBundleAnalyzer({
  reactStrictMode: true,
});
