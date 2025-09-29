// next.config.mjs
import createAnalyzer from '@next/bundle-analyzer';

console.log(process.env.ANALYZE);
const withBundleAnalyzer = createAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
  analyzerMode: 'static',
});

export default withBundleAnalyzer({
  reactStrictMode: true,
});
