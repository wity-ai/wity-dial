import { defineConfig } from 'vitepress';

export default defineConfig({
  base:        '/stack/dial/',
  title:       'DIAL',
  titleTemplate: ':title — Dialectic Interagent Language',
  description: 'Dialectic Interagent Language — open protocol for structured human-AI exchange. XML envelope encoding the pragmatic layer: what agents do in exchange, not just what they say. By Wity AI.',

  sitemap: {
    hostname: 'https://www.wity.ai',
  },

  head: [
    // Favicons — shared with wity.ai
    ['link', { rel: 'icon',             type: 'image/x-icon',  href: 'https://www.wity.ai/assets/favicon/favicon.ico' }],
    ['link', { rel: 'icon',             type: 'image/png',     sizes: '32x32', href: 'https://www.wity.ai/assets/favicon/favicon-32x32.png' }],
    ['link', { rel: 'icon',             type: 'image/png',     sizes: '16x16', href: 'https://www.wity.ai/assets/favicon/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180',      href: 'https://www.wity.ai/assets/favicon/apple-touch-icon.png' }],
    ['link', { rel: 'mask-icon',        href: 'https://www.wity.ai/assets/favicon/safari-pinned-tab.svg', color: '#000000' }],
    ['meta', { name: 'msapplication-TileImage', content: 'https://www.wity.ai/assets/favicon/mstile-150x150.png' }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],

    // Canonical
    ['link', { rel: 'canonical', href: 'https://www.wity.ai/stack/dial/' }],

    // Open Graph
    ['meta', { property: 'og:type',        content: 'website' }],
    ['meta', { property: 'og:site_name',   content: 'Wity AI' }],
    ['meta', { property: 'og:url',         content: 'https://www.wity.ai/stack/dial/' }],
    ['meta', { property: 'og:title',       content: 'DIAL — Dialectic Interagent Language by Wity AI' }],
    ['meta', { property: 'og:description', content: 'Open protocol for structured human-AI exchange. XML envelope encoding the pragmatic layer: what agents do in exchange, not just what they say. Superset of WUCE.' }],
    ['meta', { property: 'og:image',       content: 'https://uploads.wity.ai/user-uploads/accounts_wity_ai/ai_image_editor_uploads/2026_04_20T16_47_32_984Z-wity-ai-og-images.png' }],

    // Twitter
    ['meta', { name: 'twitter:card',        content: 'summary_large_image' }],
    ['meta', { name: 'twitter:creator',     content: '@wity__ai' }],
    ['meta', { name: 'twitter:url',         content: 'https://www.wity.ai/stack/dial/' }],
    ['meta', { name: 'twitter:title',       content: 'DIAL — Dialectic Interagent Language by Wity AI' }],
    ['meta', { name: 'twitter:description', content: 'Open protocol for structured human-AI exchange. XML envelope encoding the pragmatic layer: what agents do in exchange, not just what they say.' }],
    ['meta', { name: 'twitter:image',       content: 'https://uploads.wity.ai/user-uploads/accounts_wity_ai/ai_image_editor_uploads/2026_04_20T16_47_32_984Z-wity-ai-og-images.png' }],

    // Additional meta
    ['meta', { name: 'author',   content: 'Wity AI' }],
    ['meta', { name: 'keywords', content: 'DIAL, dialectic interagent language, AI protocol, structured exchange, pragmatic AI, speech acts, WUCE, agent communication, XML protocol, wity ai, open source' }],
    ['meta', { name: 'robots',   content: 'index, follow' }],

    // ld+json — SoftwareSourceCode
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'SoftwareSourceCode',
      name:       'DIAL — Dialectic Interagent Language',
      description: 'Open protocol for structured human-AI exchange. XML envelope encoding the pragmatic layer: what agents do in exchange, not just what they say. Superset of WUCE. Implemented in Rust + WASM.',
      url:        'https://www.wity.ai/stack/dial/',
      programmingLanguage: ['Rust', 'TypeScript', 'WebAssembly'],
      keywords:   'DIAL, dialectic interagent language, AI protocol, structured exchange, pragmatic AI, speech acts, WUCE',
      author: {
        '@type': 'Organization',
        name:    'Wity AI',
        url:     'https://www.wity.ai',
      },
      isPartOf: {
        '@type': 'WebSite',
        name:    'Wity AI',
        url:     'https://www.wity.ai',
      },
    })],

    // ld+json — Organization
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'Organization',
      name:       'Wity AI',
      url:        'https://www.wity.ai',
      logo: {
        '@type': 'ImageObject',
        url:     'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      },
      description: 'Wity AI builds AI-powered tools and platforms for brainstorming, content creation, and digital product workflows.',
      sameAs: [
        'https://twitter.com/wity__ai',
        'https://www.linkedin.com/company/wityai/',
        'https://www.youtube.com/@wity__ai',
        'https://www.jity.ai',
      ],
    })],
  ],

  themeConfig: {
    logo: {
      light: 'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      dark:  'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      alt:   'Wity AI',
    },

    nav: [
      { text: 'Guide',      link: '/guide/overview' },
      { text: 'Schema',     link: '/guide/schema' },
      { text: 'JS Package', link: '/guide/js-package' },
      { text: 'Patterns',   link: '/guide/patterns' },
      { text: 'llms.txt',      link: '/stack/dial/llms.txt' },
      { text: 'llms-full.txt', link: '/stack/dial/llms-full.txt' },
      {
        text: 'Wity Stack',
        items: [
          { text: 'wity.ai',          link: 'https://www.wity.ai' },
          { text: 'wity-graph',       link: 'https://www.wity.ai/stack/knowledge-graph/' },
          { text: 'wity-scene',       link: 'https://www.wity.ai/stack/scene-graph/' },
          { text: 'WUCE spec v2.3',   link: 'https://www.jity.ai/academy/en/products/wity/concepts/wity-universal-command-envelope-wuce-spec-v2-3' },
        ],
      },
    ],

    sidebar: [
      {
        text:  'Guide',
        items: [
          { text: 'Overview',          link: '/guide/overview' },
          { text: 'Schema v0.1',       link: '/guide/schema' },
          { text: 'Relation to WUCE',  link: '/guide/wuce-relation' },
          { text: 'JavaScript Package', link: '/guide/js-package' },
          { text: 'Patterns & Composability', link: '/guide/patterns' },
        ],
      },
      {
        text: 'Wity Stack',
        items: [
          { text: '↗ wity.ai',        link: 'https://www.wity.ai' },
          { text: '↗ wity-graph',     link: 'https://www.wity.ai/stack/knowledge-graph/' },
          { text: '↗ wity-scene',     link: 'https://www.wity.ai/stack/scene-graph/' },
          { text: '↗ WUCE spec v2.3', link: 'https://www.jity.ai/academy/en/products/wity/concepts/wity-universal-command-envelope-wuce-spec-v2-3' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wity-ai/wity-dial' },
    ],

    footer: {
      message: 'Part of the <a href="https://www.wity.ai">Wity AI</a> open-source stack · <a href="https://www.wity.ai/stack/knowledge-graph/">wity-graph</a> · <a href="https://www.wity.ai/stack/scene-graph/">wity-scene</a> · <a href="https://www.jity.ai/academy/en/products/wity/concepts/wity-universal-command-envelope-wuce-spec-v2-3">WUCE spec</a>',
      copyright: '© 2026 Wity AI',
    },
  },
});
