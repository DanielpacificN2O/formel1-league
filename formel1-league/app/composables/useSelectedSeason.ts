export const useSelectedSeason = () =>
  useState<string>('selectedSeason', () => 'S01')
