import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Oblivion',
  tagline: 'Kubernetes-native orchestration for AI agents',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // GitHub Pages URL
  url: 'https://itamarmarom.github.io',
  baseUrl: '/Oblivion/',

  // GitHub pages deployment config
  organizationName: 'itamarmarom',
  projectName: 'Oblivion',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/itamarmarom/Oblivion/tree/main/docs/',
          routeBasePath: '/', // Docs at root
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/oblivion-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Oblivion',
      logo: {
        alt: 'Oblivion Logo',
        src: 'img/oblivion-icon.jpeg',
        style: { borderRadius: '8px' },
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/itamarmarom/Oblivion',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/getting-started/quickstart',
            },
            {
              label: 'Slack Integration',
              to: '/integrations/slack-integration',
            },
            {
              label: 'Agent SDK',
              to: '/sdks/agent-sdk-quickstart',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/itamarmarom/Oblivion',
            },
            {
              label: 'TypeScript SDK',
              href: 'https://github.com/itamarmarom/Oblivion/tree/main/packages/agent-sdk',
            },
            {
              label: 'Python SDK',
              href: 'https://github.com/itamarmarom/Oblivion/tree/main/packages/sdk-python',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Oblivion. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'python', 'yaml', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
