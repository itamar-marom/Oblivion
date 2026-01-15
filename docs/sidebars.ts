import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/quickstart', 'getting-started/concepts'],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: ['integrations/slack-integration'],
    },
    {
      type: 'category',
      label: 'SDKs',
      items: ['sdks/agent-sdk-quickstart'],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: ['api-reference/index'],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment/configuration'],
    },
  ],
};

export default sidebars;
