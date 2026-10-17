import { prepareFlyerImage, renderCauseCampaignFlyer } from '../src/lib/server/cause-campaign-flyers'

async function main() {
  if (process.argv[3] === 'image') {
    const { slot, url } = JSON.parse(process.argv[2]) as { slot: 'logo' | 'photo'; url: string }
    process.stdout.write(JSON.stringify(await prepareFlyerImage(slot, url)), () => process.exit(0))
    return
  }
  const input = JSON.parse(process.argv[2]) as Parameters<typeof renderCauseCampaignFlyer>[0]
  process.stdout.write(Buffer.from(await renderCauseCampaignFlyer(input, process.argv[3] === 'svg' ? 'svg' : process.argv[3] === 'preview')), () => process.exit(0))
}

void main().catch(error => { console.error(error instanceof Error ? error.message : 'Flyer rendering failed.'); process.exitCode = 1 })
