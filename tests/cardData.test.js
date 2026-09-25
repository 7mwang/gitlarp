import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCardData } from '../src/cardData.js'

const days = [
  { date: '2026-09-24', commits: [{ author: 'Maya', message: 'Ship card' }], additions: 20, deletions: 3 },
  { date: '2026-09-22', commits: [{ author: 'Sam', message: 'Start card' }], additions: 5, deletions: 2 }
]
const repo = 'demo/repo'

test('combines selected days in date order and chooses the latest saved photo', () => {
  const entries = {
    'demo/repo:2026-09-22': { note: 'First pass', image: 'data:image/png;base64,first' },
    'demo/repo:2026-09-24': { note: 'Final pass', image: 'data:image/png;base64,latest' }
  }
  const result = buildCardData(days, entries, repo, '  Card launch  ')
  assert.deepEqual(result.day.selectedDates, ['2026-09-22', '2026-09-24'])
  assert.equal(result.day.startDate, '2026-09-22')
  assert.equal(result.day.date, '2026-09-24')
  assert.equal(result.day.commits.length, 2)
  assert.equal(result.day.additions, 25)
  assert.equal(result.day.deletions, 5)
  assert.equal(result.day.title, 'Card launch')
  assert.equal(result.entry.note, 'First pass  ·  Final pass')
  assert.equal(result.entry.image, 'data:image/png;base64,latest')
})

test('keeps combined line counts unavailable if one selected day is unmeasured', () => {
  const result = buildCardData([{ ...days[0], additions: null, deletions: null }, days[1]], {}, repo, 'Card')
  assert.equal(result.day.additions, null)
  assert.equal(result.day.deletions, null)
})
