/* eslint-disable @typescript-eslint/no-var-requires */
import BundleAnalyzer from '@next/bundle-analyzer'
import { createVanillaExtractPlugin } from '@vanilla-extract/next-plugin'
import vercelToolbarPlugin from '@vercel/toolbar/plugins/next'
import path from 'path'
import { fileURLToPath } from 'url'
import { RetryChunkLoadPlugin } from 'webpack-retry-chunk-load-plugin'

const withVercelToolbar = vercelToolbarPlugin()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withBundleAnalyzer = BundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const withVanillaExtract = createVanillaExtractPlugin()

const config = {
  typescript: {
    tsconfigPath: 'tsconfig.json',
  },
  compiler: {
    styledComponents: true,
  },
  experimental: {
    scrollRestoration: true,
    fallbackNodePolyfills: false,
    optimizePackageImports: ['@pancakeswap/widgets-internal', '@pancakeswap/uikit'],
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingExcludes: {
    '*': [],
  },
  transpilePackages: [
    '@pancakeswap/farms',
    '@pancakeswap/position-managers',
    '@pancakeswap/localization',
    '@pancakeswap/hooks',
    '@pancakeswap/utils',
    '@pancakeswap/widgets-internal',
    '@pancakeswap/ifos',
    '@pancakeswap/uikit',
    '@pancakeswap/wagmi',
    '@pancakeswap/canonical-bridge',
    // https://github.com/TanStack/query/issues/6560#issuecomment-1975771676
    '@tanstack/query-core',
  ],
  reactStrictMode: true,
  images: {
    contentDispositionType: 'attachment',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static-nft.pancakeswap.com',
        pathname: '/mainnet/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.pancakeswap.finance',
        pathname: '/web/**',
      },
    ],
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/info/token/:address',
          destination: '/info/tokens/:address',
        },
        {
          source: '/info/pool/:address',
          destination: '/info/pools/:address',
        },
        {
          source: '/.well-known/vercel/flags',
          destination: '/api/vercel/flags',
        },
      ],
    }
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000',
          },
        ],
      },
      {
        source: '/logo.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000',
          },
        ],
      },
      {
        source: '/images/:all*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000',
          },
        ],
      },
      {
        source: '/images/tokens/:all*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=604800',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/send',
        destination: '/swap',
        permanent: true,
      },
      {
        source: '/create/:currency*',
        destination: '/add/:currency*',
        permanent: true,
      },
      {
        source: '/affiliates-program/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/farms/archived',
        destination: '/farms/history',
        permanent: true,
      },
      {
        source: '/pool',
        destination: '/liquidity',
        permanent: true,
      },
      {
        source: '/staking',
        destination: '/pools',
        permanent: true,
      },
      {
        source: '/syrup',
        destination: '/pools',
        permanent: true,
      },
      {
        source: '/collectibles',
        destination: '/nfts',
        permanent: true,
      },
      {
        source: '/info/pools',
        destination: '/info/pairs',
        permanent: true,
      },
      {
        source: '/info/pools/:address',
        destination: '/info/pairs/:address',
        permanent: true,
      },
      {
        source: '/images/tokens/:address',
        destination: 'https://tokens.pancakeswap.finance/images/:address',
        permanent: false,
      },
    ]
  },
  webpack: (webpackConfig, { webpack, isServer }) => {
    // tree shake sentry tracing
    webpackConfig.plugins.push(
      new webpack.DefinePlugin({
        __SENTRY_DEBUG__: false,
        __SENTRY_TRACING__: false,
      }),
    )
    webpackConfig.plugins.push(
      new RetryChunkLoadPlugin({
        cacheBust: `function() {
          return 'cache-bust=' + Date.now();
        }`,
        retryDelay: `function(retryAttempt) {
          return 2 ** (retryAttempt - 1) * 500;
        }`,
        maxRetries: 5,
      }),
    )
    if (!isServer && webpackConfig.optimization.splitChunks) {
      // webpack doesn't understand worker deps on quote worker, so we need to manually add them
      // https://github.com/webpack/webpack/issues/16895
      // eslint-disable-next-line no-param-reassign
      webpackConfig.optimization.splitChunks.cacheGroups.workerChunks = {
        chunks: 'all',
        test(module) {
          const resource = module.nameForCondition?.() ?? ''
          return resource ? workerDeps.some((d) => resource.includes(d)) : false
        },
        priority: 31,
        name: 'worker-chunks',
        reuseExistingChunk: true,
      }
    }
    return webpackConfig
  },
}

export default withVercelToolbar(
  withBundleAnalyzer(
    withVanillaExtract({
      ...config,
    }),
  ),
)
