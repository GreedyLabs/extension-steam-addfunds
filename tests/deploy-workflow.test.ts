import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const deploy = workflow.split('  deploy:\n')[1]!;

describe('deployment workflow policy', () => {
  it('runs checks on pull requests and calls deployment only after successful checks', () => {
    expect(workflow).toContain('  pull_request:');
    expect(workflow).toContain('  check:');
    expect(deploy).toContain('needs: check');
    expect(deploy).toContain("if: github.event_name != 'pull_request'");
    expect(workflow).toContain('run: pnpm run ext:lint');
  });

  it('delegates packaging and per-store retry management to the shared v2 workflow', () => {
    expect(deploy).toContain(
      'uses: GreedyLabs/action-deploy-browser-extension/.github/workflows/deploy.yml@v2',
    );
    expect(deploy).not.toContain('steps:');
    expect(workflow).not.toContain('actions/github-script');
    expect(workflow).not.toContain('actions/upload-artifact');
    expect(workflow).not.toContain('actions/download-artifact');
    expect(workflow).not.toContain('strategy:');
    expect(workflow).not.toContain('concurrency:');
    expect(deploy).toContain('build-command: pnpm install --frozen-lockfile && pnpm run build:zip');
  });

  it('preserves upload-only main pushes and publish-only version tags', () => {
    expect(workflow).toContain('branches:\n      - main');
    expect(workflow).toContain("tags:\n      - 'v*'");
    expect(deploy).toContain(
      "github.event_name == 'push' && (startsWith(github.ref, 'refs/tags/') && 'publish' || 'upload') || inputs.operation",
    );
  });

  it('defaults manual runs to status and permits target or original-run selection', () => {
    expect(workflow).toContain('options: [status, upload, publish, deploy]');
    expect(workflow).toContain('default: status');
    expect(workflow).toContain('options: [both, chrome, edge]');
    expect(deploy).toContain(
      "inputs.targets != '' && inputs.targets != 'both' && inputs.targets || 'chrome, edge'",
    );
    expect(deploy).toContain('source-run-id: ${{ inputs.source-run-id }}');
  });

  it('passes the v2 publisher variable and existing credentials explicitly', () => {
    expect(deploy).toContain('chrome-publisher-id: ${{ vars.CHROME_PUBLISHER_ID }}');
    expect(deploy).toContain('chrome-extension-id: ${{ vars.CHROME_EXTENSION_ID }}');
    expect(deploy).toContain('edge-product-id: ${{ vars.EDGE_PRODUCT_ID }}');
    for (const secret of ['CHROME_SERVICE_ACCOUNT_KEY', 'EDGE_CLIENT_ID', 'EDGE_API_KEY']) {
      expect(deploy).toContain(`${secret}: \${{ secrets.${secret} }}`);
    }
    expect(workflow).toContain('  contents: read');
    expect(workflow).toContain('  actions: read');
  });
});
