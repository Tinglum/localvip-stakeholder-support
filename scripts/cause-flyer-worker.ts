import { renderCauseCampaignFlyer } from '../src/lib/server/cause-campaign-flyers'

async function main() {
  const input = JSON.parse(process.argv[2]) as Parameters<typeof renderCauseCampaignFlyer>[0]
  process.stdout.write(Buffer.from(await renderCauseCampaignFlyer(input, process.argv[3] === 'svg' ? 'svg' : process.argv[3] === 'preview')), () => process.exit(0))
}

void main().catch(error => { console.error(error instanceof Error ? error.message : 'Flyer rendering failed.'); process.exitCode = 1 })
