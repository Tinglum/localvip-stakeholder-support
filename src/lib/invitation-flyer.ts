import type { InvitationEmailInput } from './invitation-email'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] || character)

function safeHttps(value?: string) {
  try {
    const url = new URL(value || '')
    return url.protocol === 'https:' ? url.toString() : ''
  } catch { return '' }
}

function dateLabel(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat('en-US', {weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC'}).format(date).toUpperCase()
}

/** Print-ready letter flyer for a newly onboarded school or cause. */
export function buildInvitationFlyerHtml(input: InvitationEmailInput) {
  const name = escapeHtml(input.causeName.trim() || 'School or cause name')
  const program = escapeHtml(input.programLabel.trim() || 'Community programs')
  const audience = escapeHtml(input.audience.trim() || 'Leaders and supporters')
  const headline = escapeHtml(input.headline.trim() || 'THE FUNDRAISER WITH NOTHING TO SELL')
  const introduction = escapeHtml(input.introduction.trim() || `Everyday purchases can support ${input.causeName.trim() || 'your cause'}.`)
  const logo = safeHttps(input.causeLogoUrl)
  const hero = safeHttps(input.heroPhotoUrl)
  const hostArtwork = safeHttps(input.hostArtworkUrl)
  const presenterArtwork = safeHttps(input.presenterArtworkUrl)
  const brandLogo = safeHttps(input.brandLogoUrl)
  const qrImage = safeHttps(input.qrImageUrl)
  const qrDestination = safeHttps(input.qrDestinationUrl)
  const bookingUrl = safeHttps(input.separateBookingUrl)
  const cards = input.benefitCards?.length === 3 ? input.benefitCards : [
    {title: 'Local Businesses', bullets: ['Turns slow days into busy days', 'Support local schools', 'Zero upfront costs with no risk']},
    {title: 'Families & Supporters', bullets: ['Easiest fundraiser ever', 'Get extra cash back savings', 'Be a hero for our students']},
    {title: 'Your Club & School', bullets: ['Year-round free fundraiser', 'Snowball effect grows monthly', 'Community Cash bonus']},
  ]
  const cardsHtml = cards.map(card => `<div class="card"><b>${escapeHtml(card.title)}</b><span class="heart">♥</span><div class="rule"></div>${card.bullets.filter(Boolean).map(line => `<p>${escapeHtml(line)}</p>`).join('')}</div>`).join('')
  const qrHtml = qrImage && qrDestination ? `<a href="${escapeHtml(qrDestination)}" class="qr"><img src="${escapeHtml(qrImage)}" alt="Scan to RSVP"></a><div class="qr-caption">SCAN TO RSVP</div>` : '<div class="qr" aria-label="Reserved QR code space"></div>'
  const hostHtml = hostArtwork ? `<img class="host-art" src="${escapeHtml(hostArtwork)}" alt="${name} host artwork">` : `<strong>${escapeHtml(input.hostName?.trim() || '')}</strong><span>${escapeHtml(input.hostTitle?.trim() || '')}</span>`
  const presenterHtml = `${presenterArtwork ? `<img class="presenter-mark" src="${escapeHtml(presenterArtwork)}" alt="">` : ''}<div><strong>${escapeHtml(input.presenterName?.trim() || '')}</strong><span>${escapeHtml(input.presenterTitle?.trim() || '')}</span></div>`
  const brandHtml = brandLogo ? `<img class="brand-art" src="${escapeHtml(brandLogo)}" alt="LocalVIP">` : '<strong>LocalVIP</strong>'
  const bookingHtml = bookingUrl ? `<p class="booking">Teaching or coaching at this time? Book a separate meeting: <a href="${escapeHtml(bookingUrl)}">${escapeHtml(new URL(bookingUrl).host + new URL(bookingUrl).pathname)}</a></p>` : ''
  const email = escapeHtml(input.rsvpEmail.trim())
  const phone = escapeHtml(input.rsvpPhone?.trim() || '')
  const heroStyle = hero ? `background-image:linear-gradient(90deg,#07111dd9,#07111d68),url('${escapeHtml(hero)}')` : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name} meeting invitation</title><style>
@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#171a1e}.page{width:612px;height:792px;overflow:hidden;background:white;position:relative}.header{height:59px;border-bottom:2px solid #0784c9;display:flex;align-items:center;padding:0 36px;gap:12px}.school-logo{width:83px;height:42px;object-fit:contain}.header-copy{border-left:2px solid #d1dce7;padding-left:12px;font-size:19px;font-weight:900;line-height:1}.header-copy small{display:block;color:#087fc3;letter-spacing:1px;font-size:10px;margin-top:4px}.audience{margin-left:auto;text-align:right;font-size:8px;line-height:1.5;letter-spacing:1.1px;font-weight:800;color:#5b6772;max-width:140px;text-transform:uppercase}.hero{height:281px;background-color:#111d2a;background-position:center;background-size:cover;color:white;padding:17px 36px;position:relative}.eyebrow{display:inline-block;background:#ffca2e;color:#121820;padding:6px 10px;font-size:10px;letter-spacing:1px;font-weight:900}.hero h1{font-size:52px;line-height:.91;letter-spacing:-2px;font-weight:900;max-width:555px;margin:20px 0 0;text-transform:uppercase}.hero p{position:absolute;left:36px;right:36px;bottom:14px;font-size:12px;line-height:1.38;margin:0;color:#f2f4f6}.calendar{height:72px;border-left:11px solid #0784c9;display:grid;grid-template-columns:1.2fr 1fr 1fr;padding:14px 28px;gap:16px;border-bottom:1px solid #ccd8e2}.calendar>div+div{border-left:1px solid #cad4df;padding-left:16px}.label{font-size:8px;color:#5b6772;letter-spacing:1.4px;font-weight:800}.value{font-size:18px;font-weight:900;line-height:1.05;margin-top:5px;white-space:nowrap}.sub{font-size:9px;color:#62717f;margin-top:4px}.wins{height:169px;background:#edf2f6;padding:16px 36px}.wins h2{font-size:16px;margin:0 0 16px;font-weight:900}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.card{height:107px;border:1px solid #c9d6e2;border-radius:7px;background:white;padding:10px}.card b{font-size:11px}.heart{color:#087fc3;font-size:10px;margin-left:3px}.rule{height:1px;background:#bdcfdd;margin:8px 0}.card p{font-size:9px;line-height:1.1;margin:6px 0;color:#3e4a54}.card p:before{content:'●';color:#0784c9;margin-right:7px}.rsvp{height:124px;background:#0f1216;border-top:3px solid #ffca2e;color:white;display:flex;padding:15px 36px;gap:18px}.qr-wrap{width:82px;flex:none;text-align:center}.qr{display:flex;align-items:center;justify-content:center;width:80px;height:80px;border:3px solid white;border-radius:3px}.qr img{width:74px;height:74px;object-fit:contain}.qr-caption{font-size:7px;letter-spacing:1px;color:#cbd6df;margin-top:4px}.rsvp h2{font-size:17px;line-height:1.05;margin:0 0 13px}.contact{display:flex;gap:26px;font-size:12px;font-weight:700}.contact small{display:block;color:#ffca2e;font-size:8px;letter-spacing:1px;margin-bottom:4px}.contact a,.booking a{color:inherit}.booking{font-size:8px;color:#c6d0d8;margin:9px 0 0}.footer{height:87px;display:grid;grid-template-columns:2fr 1.5fr 1fr;gap:10px;padding:15px 36px}.footer small{font-size:8px;color:#65717d;letter-spacing:1.3px;font-weight:800}.footer strong{display:block;color:#104883;font-size:13px;margin-top:8px}.footer span{display:block;font-size:8px;margin-top:3px}.host-art{display:block;width:171px;height:42px;object-fit:contain;object-position:left center;margin-top:6px}.presenter{display:flex;gap:5px;align-items:center;margin-top:6px}.presenter strong{margin:0}.presenter-mark{width:25px;height:39px;object-fit:contain}.brand{align-self:center;text-align:right}.brand-art{width:90px;max-height:23px;object-fit:contain}.brand span{font-size:8px;color:#6c7882}@media screen{body{background:#e7edf3;padding:20px}.page{box-shadow:0 8px 30px #0002;margin:auto}}
</style></head><body><main class="page"><header class="header">${logo ? `<img class="school-logo" src="${escapeHtml(logo)}" alt="${name} logo">` : ''}<div class="header-copy">${name}<small>${program.toUpperCase()}</small></div><div class="audience">${audience}</div></header><section class="hero" style="${heroStyle}"><div class="eyebrow">YOU'RE INVITED · ${input.durationMinutes}-MINUTE ${escapeHtml(input.meetingPlatform.toUpperCase())}</div><h1>${headline}</h1><p>${introduction}</p></section><section class="calendar"><div><div class="label">MARK YOUR CALENDAR</div><div class="value">${escapeHtml(dateLabel(input.meetingDate))}</div></div><div><div class="label">TIME</div><div class="value">${escapeHtml(input.meetingTime.trim())} ${escapeHtml(input.timeZone.trim())}</div><div class="sub">${input.durationMinutes} minutes</div></div><div><div class="label">WHERE</div><div class="value">ON ${escapeHtml(input.meetingPlatform.toUpperCase())}</div><div class="sub">Link arrives with your invite</div></div></section><section class="wins"><h2>EVERYBODY WINS...</h2><div class="cards">${cardsHtml}</div></section><section class="rsvp"><div class="qr-wrap">${qrHtml}</div><div><h2>RSVP TO GET YOUR CALENDAR<br>INVITE &amp; ${escapeHtml(input.meetingPlatform.toUpperCase())} LINK</h2><div class="contact"><div><small>EMAIL</small><a href="mailto:${email}">${email}</a></div>${phone ? `<div><small>OR TEXT</small><a href="tel:${phone.replace(/[^\d+]/g, '')}">${phone}</a></div>` : ''}</div>${bookingHtml}</div></section><footer class="footer"><div><small>HOSTED BY</small>${hostHtml}</div><div><small>PRESENTED BY</small><div class="presenter">${presenterHtml}</div></div><div class="brand">${brandHtml}<span>Generosity pays.</span></div></footer></main></body></html>`
}
