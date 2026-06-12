import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Voyeurr',
  tagline: 'One Stop Solution for all your media request needs',
  favicon: 'img/favicon.ico',

  url: 'https://docs.voyeurr.dev',
  baseUrl: '/',
  trailingSlash: true,

  future: {
    faster: {
      swcJsMinimizer: true,
    },
  },

  organizationName: 'xirtus',
  projectName: 'voyeurr',
  deploymentBranch: 'gh-pages',

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
          routeBasePath: '/',
          path: '../docs',
          editUrl: 'https://github.com/xirtus/voyuerr/edit/main/docs/',
          docItemComponent: '@theme/ApiItem',
          async sidebarItemsGenerator({
            defaultSidebarItemsGenerator,
            ...args
          }) {
            const items = await defaultSidebarItemsGenerator(args);
            return items.filter(
              (item) =>
                !(
                  item.type === 'category' &&
                  item.label?.toLowerCase() === 'api'
                )
            );
          },
        },
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          voyeurr: {
            specPath: '../voyeurr-api.yml',
            outputDir: '../docs/api',
            sidebarOptions: {
              groupPathsBy: 'tag',
            },
            downloadUrl:
              'https://raw.githubusercontent.com/xirtus/voyuerr/refs/heads/main/voyeurr-api.yml',
            hideSendButton: true,
          } satisfies OpenApiPlugin.Options,
        },
      },
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      /**  @type {import("@easyops-cn/docusaurus-search-local").PluginOptions}  */
      {
        hashed: true,
        indexBlog: false,
        docsDir: '../docs',
        docsRouteBasePath: '/',
        explicitSearchResultPath: true,
      },
    ],
    'docusaurus-theme-openapi-docs',
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      logo: {
        alt: 'Voyeurr',
        src: 'img/logo_full.svg',
      },
      items: [
        {
          to: '/api/voyeurr-api',
          label: 'REST API',
          position: 'right',
        },
        {
          to: 'blog',
          label: 'Blog',
          position: 'right',
        },
        {
          href: 'https://discord.gg/voyeurr',
          label: 'Discord',
          position: 'right',
        },
        {
          href: 'https://github.com/xirtus/voyuerr',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Documentation',
              to: '/',
            },
            {
              label: 'REST API',
              to: '/api/voyeurr-api',
            },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/xirtus/voyuerr',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/voyeurr',
            },
            {
              label: 'Github Discussions',
              href: 'https://github.com/xirtus/voyuerr/discussions',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Voyeurr. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.shadesOfPurple,
      darkTheme: prismThemes.shadesOfPurple,
      additionalLanguages: [
        'bash',
        'powershell',
        'yaml',
        'nix',
        'nginx',
        'batch',
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
