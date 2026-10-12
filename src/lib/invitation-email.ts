export interface InvitationEmailInput {
  causeName: string
  causeLogoUrl?: string
  heroPhotoUrl?: string
  hostArtworkUrl?: string
  presenterArtworkUrl?: string
  brandLogoUrl?: string
  benefitCards?: Array<{ title: string; bullets: string[] }>
  audience: string
  programLabel: string
  headline: string
  introduction: string
  meetingDate: string
  meetingTime: string
  timeZone: string
  durationMinutes: number
  meetingPlatform: string
  meetingUrl?: string
  qrImageUrl?: string
  qrDestinationUrl?: string
  separateBookingUrl?: string
  rsvpEmail: string
  rsvpPhone?: string
  hostName?: string
  hostTitle?: string
  presenterName?: string
  presenterTitle?: string
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] || character)

function safeWebUrl(value?: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function dateLabel(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function buildInvitationEmail(input: InvitationEmailInput) {
  const name = input.causeName.trim()
  const audience = input.audience.trim()
  const program = input.programLabel.trim() || 'your programs'
  const headline = input.headline.trim() || 'THE FUNDRAISER WITH NOTHING TO SELL'
  const introduction = input.introduction.trim() || `Everyday purchases can support ${name} and ${program}.`
  const date = dateLabel(input.meetingDate)
  const logo = safeWebUrl(input.causeLogoUrl)
  const hero = safeWebUrl(input.heroPhotoUrl)
  const hostArtwork = safeWebUrl(input.hostArtworkUrl)
  const presenterArtwork = safeWebUrl(input.presenterArtworkUrl)
  const brandLogo = safeWebUrl(input.brandLogoUrl)
  const meeting = safeWebUrl(input.meetingUrl)
  const qrImage = safeWebUrl(input.qrImageUrl)
  const qrDestination = safeWebUrl(input.qrDestinationUrl)
  const separateBooking = safeWebUrl(input.separateBookingUrl)
  const phone = input.rsvpPhone?.trim() || ''
  const email = input.rsvpEmail.trim()
  const emailHref = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`RSVP: ${name} invitation`)}`
  const phoneHref = `tel:${phone.replace(/[^\d+]/g, '')}`
  const schedule = `${date} · ${input.meetingTime.trim()} ${input.timeZone.trim()}`
  const subject = `${name}: ${headline.toLowerCase()} — ${date}`
  const logoHtml = logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(name)} logo" width="110" style="display:block;max-width:110px;max-height:72px;object-fit:contain;border:0">` : ''
  const heroHtml = hero ? `<img src="${escapeHtml(hero)}" alt="${escapeHtml(name)}" width="600" style="display:block;width:100%;height:auto;border:0">` : ''
  const meetingHtml = meeting
    ? `<a href="${escapeHtml(meeting)}" style="display:inline-block;background:#ffca2e;color:#151719;font-weight:800;text-decoration:none;padding:14px 22px;border-radius:4px">Join ${escapeHtml(input.meetingPlatform)}</a>`
    : '<span style="color:#d2dce4">Meeting link arrives with your calendar invite.</span>'
  const qrHtml = qrImage && qrDestination
    ? `<td valign="top" width="132" style="padding:0 20px 0 0;text-align:center"><a href="${escapeHtml(qrDestination)}"><img src="${escapeHtml(qrImage)}" alt="Scan to RSVP" width="112" height="112" style="display:block;width:112px;height:112px;border:4px solid #fff;border-radius:4px"></a><div style="font-size:10px;letter-spacing:1px;margin-top:5px;color:#d5dce2">SCAN TO RSVP</div></td>`
    : ''
  const bookingHtml = separateBooking
    ? `<div style="margin-top:14px;color:#cbd4db;font-size:12px">Teaching or coaching at this time? <a href="${escapeHtml(separateBooking)}" style="color:#fff">Book a separate meeting</a>.</div>`
    : ''
  const benefitCards = input.benefitCards?.length === 3 ? input.benefitCards : [
    { title: 'Local businesses', bullets: ['Turns slow days into busy days', 'Easy way to support local schools', 'Zero upfront costs with no risk'] },
    { title: 'Families and supporters', bullets: ['Easiest fundraiser ever', 'Get extra cash back savings', 'Be a hero for our students'] },
    { title: name || 'Your club & school', bullets: ['Year-round free fundraiser', 'Snowball effect grows monthly', 'Community Cash bonus'] },
  ]
  const benefitHtml = benefitCards.map(card => `<td valign="top" width="33%" style="border:1px solid #cbd9e8;background:#fff;padding:13px;vertical-align:top"><strong style="font-size:14px">${escapeHtml(card.title)}</strong><div style="height:1px;background:#cbd9e8;margin:11px 0"></div>${card.bullets.filter(Boolean).map(line => `<div style="font-size:12px;line-height:1.35;margin:7px 0;color:#394550"><span style="color:#087fc3">●</span> ${escapeHtml(line)}</div>`).join('')}</td>`).join('<td width="8"></td>')
  const artwork = (url: string | null, alt: string, width: number) => url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="${width}" style="display:block;max-width:${width}px;height:auto;border:0">` : ''
  const brandHtml = brandLogo ? `<td valign="middle" width="175" style="text-align:right">${artwork(brandLogo, 'LocalVIP', 155)}</td>` : ''
  const hostHtml = input.hostName?.trim() || hostArtwork ? `<td valign="top" style="width:40%;padding:0 16px 0 0"><div style="font-size:11px;letter-spacing:2px;color:#66717c;font-weight:800">HOSTED BY</div>${hostArtwork ? artwork(hostArtwork, `${input.hostName || name} host artwork`, 190) : `<div style="font-size:18px;color:#163f76;font-weight:800;margin-top:8px">${escapeHtml(input.hostName?.trim() || '')}</div><div style="font-size:12px;color:#394550">${escapeHtml(input.hostTitle?.trim() || '')}</div>`}</td>` : ''
  const presenterHtml = input.presenterName?.trim() || presenterArtwork ? `<td valign="top" style="width:35%"><div style="font-size:11px;letter-spacing:2px;color:#66717c;font-weight:800">PRESENTED BY</div><table role="presentation" cellspacing="0" cellpadding="0"><tr>${presenterArtwork ? `<td style="padding-right:7px">${artwork(presenterArtwork, 'Presenter mark', 34)}</td>` : ''}<td><div style="font-size:18px;color:#163f76;font-weight:800;margin-top:8px">${escapeHtml(input.presenterName?.trim() || '')}</div><div style="font-size:12px;color:#394550">${escapeHtml(input.presenterTitle?.trim() || '')}</div></td></tr></table></td>` : ''
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:24px 8px;background:#edf3f8;font-family:Arial,Helvetica,sans-serif;color:#151719"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:100%;max-width:600px;margin:0 auto;background:#fff;border-collapse:collapse"><tr><td style="padding:24px 28px;border-bottom:4px solid #087fc3"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="120">${logoHtml}</td><td><div style="font-size:25px;line-height:1.05;font-weight:900">${escapeHtml(name)}</div><div style="font-size:13px;letter-spacing:2px;color:#126aa8;font-weight:800;margin-top:5px">${escapeHtml(program.toUpperCase())}</div></td></tr></table></td></tr><tr><td style="background:#151d25">${heroHtml}<div style="padding:28px;color:#fff"><div style="display:inline-block;background:#ffca2e;color:#151719;font-size:12px;letter-spacing:2px;font-weight:800;padding:8px 10px">YOU'RE INVITED · ${input.durationMinutes}-MINUTE ${escapeHtml(input.meetingPlatform.toUpperCase())}</div><div style="font-size:42px;line-height:1.03;font-weight:900;margin-top:22px">${escapeHtml(headline)}</div><p style="font-size:16px;line-height:1.5;color:#e7ecf0;margin:22px 0 0">${escapeHtml(introduction)}</p></div></td></tr><tr><td style="border-left:8px solid #087fc3;padding:25px 28px"><div style="font-size:11px;color:#66717c;letter-spacing:2px;font-weight:800">MARK YOUR CALENDAR</div><div style="font-size:26px;font-weight:900;margin-top:7px">${escapeHtml(date)}</div><div style="font-size:19px;font-weight:800;margin-top:8px">${escapeHtml(input.meetingTime.trim())} ${escapeHtml(input.timeZone.trim())} · ${escapeHtml(input.meetingPlatform)}</div><div style="font-size:13px;color:#66717c;margin-top:5px">${input.durationMinutes} minutes</div></td></tr><tr><td style="background:#f3f8fc;padding:25px 28px"><div style="font-size:21px;font-weight:900;margin-bottom:18px">EVERYBODY WINS...</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${benefitHtml}</tr></table></td></tr><tr><td style="background:#151719;border-top:5px solid #ffca2e;color:#fff;padding:28px"><table role="presentation" cellspacing="0" cellpadding="0"><tr>${qrHtml}<td valign="top"><div style="font-size:23px;line-height:1.15;font-weight:900">RSVP TO GET YOUR CALENDAR INVITE &amp; ${escapeHtml(input.meetingPlatform.toUpperCase())} LINK</div><div style="margin-top:20px">${meetingHtml}</div>${bookingHtml}<div style="margin-top:22px;font-size:14px"><a href="${escapeHtml(emailHref)}" style="color:#fff;font-weight:800">${escapeHtml(email)}</a>${phone ? ` &nbsp;·&nbsp; <a href="${escapeHtml(phoneHref)}" style="color:#fff;font-weight:800">${escapeHtml(phone)}</a>` : ''}</div></td></tr></table></td></tr>${hostHtml || presenterHtml || brandHtml ? `<tr><td style="padding:24px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${hostHtml}${presenterHtml}${brandHtml}</tr></table></td></tr>` : ''}<tr><td style="padding:14px 28px;border-top:1px solid #d7e1ea;color:#7b8792;font-size:11px">${escapeHtml(name)} · ${escapeHtml(audience)} · LocalVIP · Generosity pays.</td></tr></table></body></html>`
  const plainText = `${name}\n${audience}\n\n${headline}\n${introduction}\n\n${schedule}\n${input.durationMinutes} minutes on ${input.meetingPlatform}\n${meeting ? `Meeting link: ${meeting}\n` : 'Meeting link arrives with your calendar invite.\n'}\nRSVP: ${email}${phone ? ` or ${phone}` : ''}${qrDestination ? `\nQR RSVP: ${qrDestination}` : ''}${separateBooking ? `\nSeparate meeting: ${separateBooking}` : ''}`
  return { subject, html, plainText }
}





