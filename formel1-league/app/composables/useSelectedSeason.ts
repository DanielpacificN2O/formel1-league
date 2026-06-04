export const useSelectedSeason = () =>
  useState<string>('selectedSeason', () => 'S29')
