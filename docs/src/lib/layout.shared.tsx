import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const gitConfig = {
  user: 'serenity-kit',
  repo: 'riblt',
  branch: 'set-sync',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'riblt',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
