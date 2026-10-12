import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInvitationFlyerHtml } from '../src/lib/invitation-flyer'

const newCause = {
  causeName: 'River Valley School',
  audience: 'Booster leaders',
  programLabel: 'Athletics & activities',
  headline: 'THE FUNDRAISER WITH NOTHING TO SELL',
  introduction: 'Everyday purchases can support River Valley School.',
  meetingDate: '2026-10-12',
  meetingTime: '1:30 PM',
  timeZone: 'CT',
  durationMinutes: 30,
  meetingPlatform: 'Zoom',
  rsvpEmail: 'hello@example.org',
  rsvpPhone: '555-0100',
  benefitCards: [
    { title: 'Local Businesses', bullets: ['Welcome families'] },
    { title: 'Parents', bullets: ['Shop nearby'] },
    { title: 'School', bullets: ['Support students'] },
  ],
}

test('a new cause gets its own invitation with an empty QR slot', () => {
  const html = buildInvitationFlyerHtml(newCause)
  assert.match(html, /River Valley School/)
  assert.match(html, /MONDAY, OCT 12/)
  assert.match(html, /1:30 PM CT/)
  assert.match(html, /Welcome families/)
  assert.match(html, /Reserved QR code space/)
  assert.doesNotMatch(html, /Olathe Northwest|SCAN TO RSVP/)
})

test('the supplied QR image appears only with its destination', () => {
  const html = buildInvitationFlyerHtml({
    ...newCause,
    qrImageUrl: 'https://example.org/qr.png',
    qrDestinationUrl: 'https://example.org/rsvp',
  })
  assert.match(html, /https:\/\/example.org\/qr.png/)
  assert.match(html, /https:\/\/example.org\/rsvp/)
  assert.match(html, /SCAN TO RSVP/)
  assert.doesNotMatch(buildInvitationFlyerHtml({...newCause, qrImageUrl: 'https://example.org/qr.png'}), /SCAN TO RSVP/)
})
