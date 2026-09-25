export function buildCardData(days, entries, repo, title) {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date))
  if (!ordered.length) throw new Error('Select a work day first.')
  const complete = key => ordered.every(day => day[key] !== null && day[key] !== undefined)
  const latestPhotoDay = [...ordered].reverse().find(day => entries[`${repo}:${day.date}`]?.image)
  const note = ordered.map(day => entries[`${repo}:${day.date}`]?.note?.trim()).filter(Boolean).join('  ·  ')
  return {
    day: {
      date: ordered.at(-1).date,
      startDate: ordered[0].date,
      selectedDates: ordered.map(day => day.date),
      repo,
      title: title.trim(),
      commits: [...ordered].reverse().flatMap(day => day.commits),
      additions: complete('additions') ? ordered.reduce((sum, day) => sum + day.additions, 0) : null,
      deletions: complete('deletions') ? ordered.reduce((sum, day) => sum + day.deletions, 0) : null
    },
    entry: { note, image: latestPhotoDay ? entries[`${repo}:${latestPhotoDay.date}`].image : null },
    imageDate: latestPhotoDay?.date || null
  }
}
