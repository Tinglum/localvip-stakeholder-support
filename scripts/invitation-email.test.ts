import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInvitationEmail } from '../src/lib/invitation-email'

test('meeting invitation uses cause details and excludes a QR code', () => {
  const result = buildInvitationEmail({
    causeName: 'Olathe Northwest',
    causeLogoUrl: 'https://example.org/logo.png',
    heroPhotoUrl: 'https://example.org/football.jpg',
    audience: 'Booster leaders',
    programLabel: 'Athletics & activities',
    headline: 'THE FUNDRAISER WITH NOTHING TO SELL',
    introduction: 'Everyday purchases fund our programs.',
    meetingDate: '2026-09-28',
    meetingTime: '12:00 PM',
    timeZone: 'CT',
    durationMinutes: 30,
    meetingPlatform: 'Zoom',
    meetingUrl: 'https://example.org/meeting',
    rsvpEmail: 'rick@localvip.com',
    hostName: 'Kayla Barnes',
  })
  assert.match(result.html, /Monday, September 28, 2026/)
  assert.match(result.html, /https:\/\/example.org\/football.jpg/)
  assert.match(result.html, /Kayla Barnes/)
  assert.doesNotMatch(result.html, /qr.code|qr-code|<svg/i)
  assert.match(result.plainText, /12:00 PM CT/)
})

test('user content is escaped and unsafe image URLs are rejected', () => {
  const result = buildInvitationEmail({
    causeName: '<script>alert(1)</script>', causeLogoUrl: 'javascript:alert(1)', audience: 'Parents',
    programLabel: 'Programs', headline: 'Meet & learn', introduction: '<b>Welcome</b>',
    meetingDate: '2026-09-28', meetingTime: 'noon', timeZone: 'CT', durationMinutes: 30,
    meetingPlatform: 'Zoom', rsvpEmail: 'hello@example.org',
  })
  assert.doesNotMatch(result.html, /<script>|javascript:/i)
  assert.match(result.html, /&lt;script&gt;/)
  assert.match(result.html, /&lt;b&gt;Welcome&lt;\/b&gt;/)
})

test('QR slot stays empty by default and renders supplied artwork with its destination', () => {
  const details = {
    causeName: 'Olathe Northwest', audience: 'Booster leaders', programLabel: 'Athletics',
    headline: 'Join us', introduction: 'Learn more', meetingDate: '2026-09-28',
    meetingTime: '12:00 PM', timeZone: 'CT', durationMinutes: 30,
    meetingPlatform: 'Zoom', rsvpEmail: 'hello@example.org',
  }
  assert.doesNotMatch(buildInvitationEmail(details).html, /SCAN TO RSVP/)
  const withQr = buildInvitationEmail({
    ...details,
    qrImageUrl: 'https://example.org/qr.png',
    qrDestinationUrl: 'https://example.org/rsvp',
    separateBookingUrl: 'https://example.org/book',
  }).html
  assert.match(withQr, /SCAN TO RSVP/)
  assert.match(withQr, /https:\/\/example.org\/qr.png/)
  assert.match(withQr, /https:\/\/example.org\/rsvp/)
  assert.match(withQr, /https:\/\/example.org\/book/)
})

test('original benefit copy and optional footer artwork appear in the email', () => {
  const result = buildInvitationEmail({
    causeName: 'Olathe Northwest', audience: 'Booster leaders', programLabel: 'Athletics',
    headline: 'Join us', introduction: 'Learn more', meetingDate: '2026-09-28',
    meetingTime: '12:00 PM', timeZone: 'CT', durationMinutes: 30,
    meetingPlatform: 'Zoom', rsvpEmail: 'hello@example.org',
    hostName: 'Kayla Barnes', presenterName: 'Rick Swanson',
    hostArtworkUrl: 'https://example.org/host.png',
    presenterArtworkUrl: 'https://example.org/pin-blue.svg',
    brandLogoUrl: 'https://example.org/logo-blue.svg',
    benefitCards: [
      {title: 'Olathe Businesses', bullets: ['Turns slow days into busy days']},
      {title: 'Olathe Parents', bullets: ['Easiest fundraiser ever']},
      {title: 'Your Club & School', bullets: ['Community Cash bonus']},
    ],
  })
  for (const phrase of ['Olathe Businesses', 'Turns slow days into busy days', 'Olathe Parents', 'Easiest fundraiser ever', 'Community Cash bonus', 'host.png', 'pin-blue.svg', 'logo-blue.svg']) {
    assert.ok(result.html.includes(phrase), phrase)
  }
})

